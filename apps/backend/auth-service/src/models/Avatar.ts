import { Schema, model, Document } from 'mongoose';

/**
 * A profile picture someone uploaded.
 *
 * Stored here rather than in file-service because it is tiny (the browser
 * shrinks it to 256px before sending, a few tens of kilobytes) and because its
 * URL has to be permanent: it rides in the session token, and every other
 * service shows it from there. A file-service download URL is signed and
 * expires, so it could not be put in a token that lives for days.
 *
 * Kept in its own collection so the bytes are never loaded with the user
 * document, which is read on every sign-in and token renewal.
 */
export interface IAvatar extends Document {
  userId: string;
  data: Buffer;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
}

const AvatarSchema = new Schema<IAvatar>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true }
  },
  { timestamps: true }
);

export const Avatar = model<IAvatar>('Avatar', AvatarSchema);
