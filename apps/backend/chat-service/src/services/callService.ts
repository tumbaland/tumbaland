import { Types } from 'mongoose';
import { BadRequestError, ConflictError, NotFoundError, logger } from '@tumbaland/backend-core';
import { Call, type CallEndReason, type ICall } from '../models/Call';
import { Conversation, type IConversation } from '../models/Conversation';
import { requireConversation, type Caller } from './accessService';
import { postSystemLine } from './messageService';
import { isPushConfigured, sendToUsers } from './pushService';
import { isDeviceOnline, publishToUsers, type ChatEventType } from './streamHub';

/**
 * Voice calls: ringing, answering, hanging up, and passing WebRTC signals
 * between the two browsers.
 *
 * The server never touches audio. What it owns is everything the two phones
 * cannot agree on alone: who is calling whom, which device answered, when the
 * ringing stops, and whether a call whose other end vanished is still a call.
 *
 * Timers live in this process, which is fine for the same reason the stream
 * hub is: chat-service is one replica. The sweep below also catches anything a
 * restart left behind, so a lost timer costs a few seconds, not a stuck call.
 */

/** How long a call rings before it counts as missed. */
export const RING_TIMEOUT_MS = 45_000;

/**
 * How long a side of an answered call may be without a stream before the call
 * is ended for it. The stream stays open during a call even with the screen
 * off, so losing it means the app was closed or the phone lost signal. Long
 * enough to ride out a tunnel or a Wi-Fi to 4G switch.
 */
export const DROP_GRACE_MS = 45_000;

const SWEEP_MS = 10_000;

export interface CallPersonView {
  userId: string;
  name: string;
  picture: string | null;
}

export interface CallView {
  id: string;
  conversationId: string;
  caller: CallPersonView;
  callees: CallPersonView[];
  callerDeviceId: string;
  answeredBy: string | null;
  answeredDeviceId: string | null;
  status: ICall['status'];
  endReason: CallEndReason | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

export function toCallView(call: ICall): CallView {
  const person = (p: { userId: string; name: string; picture?: string | null }): CallPersonView => ({
    userId: p.userId,
    name: p.name,
    picture: p.picture ?? null
  });
  return {
    id: call._id.toString(),
    conversationId: call.conversationId,
    caller: person(call.caller),
    callees: call.callees.map(person),
    callerDeviceId: call.callerDeviceId,
    answeredBy: call.answeredBy,
    answeredDeviceId: call.answeredDeviceId,
    status: call.status,
    endReason: call.endReason,
    startedAt: call.createdAt.toISOString(),
    answeredAt: call.answeredAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null
  };
}

const participants = (call: ICall): string[] => [call.caller.userId, ...call.callees.map((c) => c.userId)];

function publish(call: ICall, type: ChatEventType, payload: unknown = toCallView(call)): void {
  publishToUsers(participants(call), call.groupId, {
    type,
    conversationId: call.conversationId,
    at: Date.now(),
    payload
  });
}

/** Any live call this person is part of, on either side. */
function liveCallOf(userId: string) {
  return Call.findOne({
    status: { $in: ['ringing', 'active'] },
    $or: [{ 'caller.userId': userId }, { 'callees.userId': userId }]
  });
}

const ringTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRingTimer(callId: string): void {
  const timer = ringTimers.get(callId);
  if (timer) clearTimeout(timer);
  ringTimers.delete(callId);
}

/**
 * Runs call starts one after another. "Is either person busy?" and creating
 * the call are two queries, so two people pressing Call at the same moment
 * would otherwise both see "free" and ring each other with two calls that can
 * never be answered. One process (see the top of this file), so a promise
 * chain is the whole lock.
 */
let startQueue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = startQueue.then(task, task);
  startQueue = run.catch(() => undefined);
  return run;
}

export async function startCall(person: Caller, conversation: IConversation, deviceId: string): Promise<CallView> {
  const others = conversation.members.filter((member) => member.userId !== person.id);
  if (others.length !== 1) {
    throw new BadRequestError('Calls are between two people for now');
  }
  const callee = others[0]!;

  const call = await oneAtATime(async () => {
    // Anything left ringing by a crash is tidied first, so a stale row cannot
    // make someone permanently busy.
    await sweepCalls();

    if (await liveCallOf(person.id)) throw new ConflictError('You are already in a call');
    if (await liveCallOf(callee.userId)) throw new ConflictError(`${callee.name || 'They'} is on another call`);

    return Call.create({
      conversationId: conversation._id.toString(),
      groupId: conversation.groupId,
      caller: { userId: person.id, email: person.email, name: person.name, picture: person.picture ?? null },
      callees: [{ userId: callee.userId, name: callee.name, picture: callee.picture ?? null }],
      callerDeviceId: deviceId
    });
  });

  publish(call, 'call.ringing');

  const callId = call._id.toString();
  const timer = setTimeout(() => {
    ringTimers.delete(callId);
    void finishIfLive(callId, ['ringing'], 'missed').catch((error: Error) =>
      logger.warn('Could not time out a call', { callId, error: error.message })
    );
  }, RING_TIMEOUT_MS);
  timer.unref();
  ringTimers.set(callId, timer);

  // Push is what rings a phone whose app is closed. Short-lived on purpose: a
  // "calling you" delivered after the ringing stopped is worse than none.
  if (isPushConfigured()) {
    void sendToUsers(
      [callee.userId],
      {
        title: person.name || 'Tumbaland',
        body: 'Calling you',
        tag: `call-${callId}`,
        url: `/chat/${call.conversationId}`,
        kind: 'call'
      },
      { ttlSeconds: Math.round(RING_TIMEOUT_MS / 1000) }
    ).catch((error: Error) => logger.warn('Call push failed', { error: error.message }));
  }

  return toCallView(call);
}

/**
 * The call, if this person is in it and can still see its conversation.
 * Anything else is a 404, as for messages.
 */
async function requireCall(person: Caller, callId: string): Promise<ICall> {
  if (!Types.ObjectId.isValid(callId)) throw new NotFoundError('Call not found');
  const call = await Call.findById(callId);
  if (!call || !participants(call).includes(person.id)) throw new NotFoundError('Call not found');
  await requireConversation(person, call.conversationId);
  return call;
}

export async function acceptCall(person: Caller, callId: string, deviceId: string): Promise<CallView> {
  const call = await requireCall(person, callId);
  if (!call.callees.some((callee) => callee.userId === person.id)) {
    throw new BadRequestError('You cannot answer your own call');
  }

  // Conditional on still ringing, so two devices answering at once cannot both
  // win: one gets the call, the other a conflict.
  const accepted = await Call.findOneAndUpdate(
    { _id: call._id, status: 'ringing' },
    { $set: { status: 'active', answeredBy: person.id, answeredDeviceId: deviceId, answeredAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!accepted) {
    const current = await Call.findById(call._id);
    throw new ConflictError(
      current?.status === 'active' ? 'Answered on another device' : 'The call has already ended'
    );
  }

  clearRingTimer(callId);
  publish(accepted, 'call.accepted');
  takeDownRinging(accepted, 'Answered on another device');
  return toCallView(accepted);
}

export async function declineCall(person: Caller, callId: string): Promise<CallView> {
  const call = await requireCall(person, callId);
  const ended = await finishIfLive(call._id.toString(), ['ringing'], 'declined');
  if (ended) takeDownRinging(ended, 'Declined');
  return toCallView(ended ?? call);
}

/**
 * Hanging up, from either side, at any point. Ending an ended call is a no-op.
 *
 * The reason is settled by which update wins, not by the status read first:
 * a caller giving up at the moment the other person answers must end an
 * answered call as a hang-up, not record it as a missed one.
 */
export async function endCall(person: Caller, callId: string): Promise<CallView> {
  const call = await requireCall(person, callId);
  const id = call._id.toString();
  const unanswered: CallEndReason = call.caller.userId === person.id ? 'cancelled' : 'declined';

  const ended =
    (await finishIfLive(id, ['active'], 'hangup')) ??
    (await finishIfLive(id, ['ringing'], unanswered)) ??
    // Answered between the two attempts above.
    (await finishIfLive(id, ['active'], 'hangup'));

  if (ended?.endReason === 'declined') takeDownRinging(ended, 'Declined');
  return toCallView(ended ?? (await Call.findById(id)) ?? call);
}

/**
 * Replaces "Calling you" on every device of the people called, for a call
 * answered or declined on one of them. A locked phone would otherwise keep
 * showing a ringing call through the whole conversation and after it.
 */
function takeDownRinging(call: ICall, body: string): void {
  if (!isPushConfigured()) return;
  void sendToUsers(
    call.callees.map((callee) => callee.userId),
    {
      title: call.caller.name || 'Tumbaland',
      body,
      tag: `call-${call._id.toString()}`,
      url: `/chat/${call.conversationId}`,
      kind: 'call-over'
    },
    { ttlSeconds: Math.round(RING_TIMEOUT_MS / 1000) }
  ).catch((error: Error) => logger.warn('Could not take down a ringing notification', { error: error.message }));
}

export interface SignalData {
  description?: { type: 'offer' | 'answer'; sdp: string };
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  } | null;
}

/**
 * Passes an offer, an answer or an ICE candidate to the other device.
 *
 * Only the two devices in the call may signal, and each only as itself: the
 * device id is checked against the one that placed or answered the call, so a
 * second tab of the same person cannot talk its way into the connection.
 */
export async function relaySignal(person: Caller, callId: string, deviceId: string, data: SignalData): Promise<void> {
  const call = await requireCall(person, callId);
  if (call.status !== 'active') throw new ConflictError('The call is not connected');

  const fromCaller = person.id === call.caller.userId && deviceId === call.callerDeviceId;
  const fromCallee = person.id === call.answeredBy && deviceId === call.answeredDeviceId;
  if (!fromCaller && !fromCallee) throw new ConflictError('This device is not in the call');

  const toUserId = fromCaller ? call.answeredBy! : call.caller.userId;
  const toDeviceId = fromCaller ? call.answeredDeviceId! : call.callerDeviceId;

  publishToUsers([toUserId], call.groupId, {
    type: 'call.signal',
    conversationId: call.conversationId,
    at: Date.now(),
    payload: { callId, fromDeviceId: deviceId, toDeviceId, data }
  });
}

/** This person's live call, so an app opened from a "Calling you" notification can show it. */
export async function currentCall(person: Caller): Promise<CallView | null> {
  await sweepCalls();
  const call = await liveCallOf(person.id);
  if (!call) return null;
  // Access is re-checked rather than assumed: they may have left the group.
  try {
    await requireConversation(person, call.conversationId);
  } catch {
    return null;
  }
  return toCallView(call);
}

/**
 * Ends the call if it is still in one of `from`, and does everything an ending
 * means: tells both sides, writes the line in the thread, and replaces the
 * "Calling you" notification with a missed call where nobody answered.
 *
 * Conditional, so a hang-up racing the ring timeout ends the call once.
 */
async function finishIfLive(callId: string, from: Array<ICall['status']>, reason: CallEndReason): Promise<ICall | null> {
  const ended = await Call.findOneAndUpdate(
    { _id: callId, status: { $in: from } },
    { $set: { status: 'ended', endReason: reason, endedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!ended) return null;

  clearRingTimer(callId);
  dropWatch.delete(callId);
  publish(ended, 'call.ended');

  try {
    const conversation = await Conversation.findById(ended.conversationId);
    if (conversation) {
      const sender: Caller = {
        id: ended.caller.userId,
        email: ended.caller.email,
        name: ended.caller.name,
        groups: [ended.groupId]
      };
      await postSystemLine(sender, conversation, callLine(ended));
    }
  } catch (error) {
    logger.warn('Could not write the call into the thread', { callId, error: (error as Error).message });
  }

  if ((reason === 'missed' || reason === 'cancelled') && isPushConfigured()) {
    // Same tag as the ringing notification, so it is replaced rather than
    // joined by a second one.
    void sendToUsers(
      ended.callees.map((callee) => callee.userId),
      {
        title: ended.caller.name || 'Tumbaland',
        body: 'Missed call',
        tag: `call-${callId}`,
        url: `/chat/${ended.conversationId}`
      }
    ).catch((error: Error) => logger.warn('Missed call push failed', { error: error.message }));
  }

  return ended;
}

/** "Call, 12 min" for an answered call, "Missed call from Tom" for one that was not. */
export function callLine(call: ICall): string {
  if (!call.answeredAt) return `Missed call from ${call.caller.name || 'someone'}`;
  const seconds = Math.max(0, Math.round(((call.endedAt ?? new Date()).getTime() - call.answeredAt.getTime()) / 1000));
  return `Call, ${formatDuration(seconds)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** When each side of an answered call was first seen without a stream. */
const dropWatch = new Map<string, number>();

/**
 * Ends what nobody will end: calls still ringing past the timeout (a restart
 * lost the timer) and answered calls where one side has had no stream for
 * `DROP_GRACE_MS` (the app was closed, or the phone went out of range).
 */
export async function sweepCalls(now = Date.now()): Promise<void> {
  const stale = await Call.find({ status: 'ringing', createdAt: { $lt: new Date(now - RING_TIMEOUT_MS - 5_000) } });
  for (const call of stale) await finishIfLive(call._id.toString(), ['ringing'], 'missed');

  const active = await Call.find({ status: 'active' });
  for (const call of active) {
    const callId = call._id.toString();
    // The two tabs in the call, not the two people: either may have another
    // tab open elsewhere, which says nothing about the one on the call.
    const bothThere =
      isDeviceOnline(call.caller.userId, call.callerDeviceId) &&
      (!call.answeredBy || !call.answeredDeviceId || isDeviceOnline(call.answeredBy, call.answeredDeviceId));
    if (bothThere) {
      dropWatch.delete(callId);
      continue;
    }
    const since = dropWatch.get(callId) ?? now;
    dropWatch.set(callId, since);
    if (now - since >= DROP_GRACE_MS) await finishIfLive(callId, ['active'], 'dropped');
  }
}

export function startCallSweep(): () => void {
  const timer = setInterval(() => {
    sweepCalls().catch((error: Error) => logger.warn('Call sweep failed', { error: error.message }));
  }, SWEEP_MS);
  timer.unref();
  return () => clearInterval(timer);
}

/** Test seam: forgets timers and drop tracking. */
export function resetCallTimers(): void {
  for (const timer of ringTimers.values()) clearTimeout(timer);
  ringTimers.clear();
  dropWatch.clear();
}
