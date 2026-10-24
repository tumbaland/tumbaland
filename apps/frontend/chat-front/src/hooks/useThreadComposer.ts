import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ComposerProps } from '../components/thread/Composer';
import { messageSummary } from '../services/summary';
import { clearShare, isMedia, readShare, sharedMessage } from '@tumbaland/frontend-core';
import { uploadVoice, useAttachmentUploads } from './useAttachmentUploads';
import { useVoiceMessage, type SendVoice } from './useVoiceMessage';
import type { UseChatThreadResult } from './useChatThread';
import type { SendOptions } from '../types';

interface Options {
  conversationId: string | undefined;
  currentUserId: string;
  thread: Pick<UseChatThreadResult, 'messages' | 'members' | 'edit' | 'send' | 'notifyTyping' | 'setPhotoAlbum'>;
  /** Shared links/files belong to the routed thread, never the desktop side panel. */
  acceptShared: boolean;
  onError: (message: string) => void;
}

/** The composer's edit/reply session, attachments, voice recording and incoming share. */
export function useThreadComposer({ conversationId, currentUserId, thread, acceptShared, onError }: Options) {
  const uploads = useAttachmentUploads(conversationId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const find = (id: string | null) => thread.messages.find((message) => message.id === id);

  useEffect(() => setReplyingId(null), [conversationId]);
  const parent = find(replyingId);
  const replying =
    parent && !parent.deletedAt
      ? {
          id: parent.id,
          name:
            parent.senderId === currentUserId
              ? 'yourself'
              : thread.members.find((member) => member.userId === parent.senderId)?.name || parent.senderName,
          text: messageSummary(parent)
        }
      : null;
  const edited = find(editingId);
  const editing =
    edited && !edited.deletedAt ? { id: edited.id, body: edited.body, hasMedia: edited.attachments.length > 0 } : null;

  const reply = (messageId: string) => {
    setEditingId(null);
    setReplyingId(messageId);
  };
  const edit = (messageId: string) => {
    setReplyingId(null);
    setEditingId(messageId);
  };
  const cancelEditFor = (messageId: string) => {
    if (editingId === messageId) setEditingId(null);
  };
  const saveEdit = async (body: string) => {
    if (!editing) return;
    try {
      await thread.edit(editing.id, body);
      setEditingId(null);
    } catch {
      onError('Could not save the edit. Try again.');
    }
  };

  const send = (body: string, options?: SendOptions) => {
    const replyTo = replying?.id;
    // Taking the queue sends text and attachments together, exactly once.
    void thread.send(body, uploads.take(), replyTo ? { ...options, replyTo } : options);
    setReplyingId(null);
  };
  const sendVoice: SendVoice = async (recording, onProgress) => {
    if (!conversationId) return;
    const replyTo = replying?.id;
    const attachment = await uploadVoice(conversationId, recording, onProgress);
    void thread.send('', [attachment], replyTo ? { replyTo } : undefined);
    setReplyingId(null);
  };
  const voice = useVoiceMessage(conversationId, sendVoice);

  const [searchParams, setSearchParams] = useSearchParams();
  const sharing = acceptShared && searchParams.has('shared');
  const [prefill, setPrefill] = useState<{ text: string; key: number; conversationId: string } | null>(null);
  const addUploads = uploads.add;
  useEffect(() => {
    if (!sharing || !conversationId) return;
    let active = true;
    void readShare().then(async (share) => {
      if (!active) return;
      if (share) {
        const media = share.files.filter(isMedia);
        if (media.length > 0) void addUploads(media);
        const text = sharedMessage(share);
        if (text) setPrefill({ text, key: Date.now(), conversationId });
        // Clear only after the share has reached this conversation's composer.
        await clearShare();
      }
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete('shared');
          return next;
        },
        { replace: true }
      );
    });
    return () => {
      active = false;
    };
  }, [sharing, conversationId, addUploads, setSearchParams]);

  const turnAlbumOff = async () => {
    try {
      await thread.setPhotoAlbum({ mode: 'off' });
    } catch {
      onError('Could not change that. Try again.');
    }
  };

  const props = {
    onSend: send,
    onTyping: thread.notifyTyping,
    uploads: uploads.uploads,
    onAddFiles: uploads.add,
    onRemoveUpload: uploads.remove,
    uploading: uploads.busy,
    voice,
    editing,
    onSaveEdit: (body: string) => void saveEdit(body),
    onCancelEdit: () => setEditingId(null),
    replying,
    onCancelReply: () => setReplyingId(null),
    onAlbumOff: () => void turnAlbumOff(),
    prefill: prefill?.conversationId === conversationId ? prefill : null
  } satisfies ComposerProps;

  return { props, reply, edit, cancelEditFor };
}
