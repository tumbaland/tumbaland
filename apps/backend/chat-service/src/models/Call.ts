import { Schema, model, Document, Types } from 'mongoose';

/**
 * One voice call, from the first ring to the hang-up.
 *
 * The audio never passes through here: the two browsers talk directly (or
 * through the TURN relay). This row is what rings, who answered on which
 * device, and how it ended, which is also what the thread's "Call, 12 min"
 * line is made from.
 *
 * `ringing` and `active` are the live states. At most one live call per person
 * is the rule that makes "busy" mean something, and it is enforced by the
 * service rather than an index, since the person can be on either side.
 */

export type CallStatus = 'ringing' | 'active' | 'ended';

/**
 * - `hangup`: someone ended an answered call.
 * - `declined`: the person called said no.
 * - `cancelled`: the caller gave up before an answer.
 * - `missed`: nobody answered in time.
 * - `dropped`: one side vanished (closed the app, lost signal) and did not come back.
 */
export type CallEndReason = 'hangup' | 'declined' | 'cancelled' | 'missed' | 'dropped';

export interface ICallPerson {
  userId: string;
  name: string;
  picture?: string | null;
}

export interface ICall extends Document {
  _id: Types.ObjectId;
  conversationId: string;
  /** Checked against each subscriber's groups before an event is delivered, as for messages. */
  groupId: string;
  caller: ICallPerson & { email: string };
  /** Everyone rung. One person today; a list so group calls need no migration. */
  callees: ICallPerson[];
  /** The tab that placed the call. Signals go to this device only, not to the caller's others. */
  callerDeviceId: string;
  /** Who picked up, and on which device. Null until then. */
  answeredBy: string | null;
  answeredDeviceId: string | null;
  status: CallStatus;
  endReason: CallEndReason | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new Schema<ICallPerson>(
  {
    userId: { type: String, required: true },
    name: { type: String, default: '' },
    picture: { type: String, default: null }
  },
  { _id: false }
);

const CallSchema = new Schema<ICall>(
  {
    conversationId: { type: String, required: true, index: true },
    groupId: { type: String, required: true },
    caller: {
      type: new Schema(
        {
          userId: { type: String, required: true },
          email: { type: String, default: '' },
          name: { type: String, default: '' },
          picture: { type: String, default: null }
        },
        { _id: false }
      ),
      required: true
    },
    callees: { type: [PersonSchema], default: [] },
    callerDeviceId: { type: String, required: true },
    answeredBy: { type: String, default: null },
    answeredDeviceId: { type: String, default: null },
    status: { type: String, enum: ['ringing', 'active', 'ended'], default: 'ringing' },
    endReason: { type: String, enum: ['hangup', 'declined', 'cancelled', 'missed', 'dropped', null], default: null },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// "Is this person already on a call?", asked on every start and on app open.
CallSchema.index({ status: 1, 'caller.userId': 1 });
CallSchema.index({ status: 1, 'callees.userId': 1 });

export const Call = model<ICall>('Call', CallSchema);
