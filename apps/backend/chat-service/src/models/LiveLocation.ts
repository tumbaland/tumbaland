import { Schema, model, Document } from 'mongoose';

/** Where the person sharing is, as their phone last said. */
export interface ILivePosition {
  lat: number;
  lng: number;
  /** Metres, as the phone reports it. */
  accuracy: number | null;
  /** Degrees clockwise from north, while moving. */
  heading: number | null;
  /** Metres per second. */
  speed: number | null;
  at: Date;
}

/** Where the person sharing is heading, when they marked it on the map. */
export interface ILiveDestination {
  lat: number;
  lng: number;
  /** A saved place's name or the address it is at, as the sharer picked it. */
  label?: string | null;
}

/**
 * Someone waiting for the person sharing: told once, by a push, when they come
 * within `radiusM` of the point the waiter stood at when they asked.
 */
export interface ILiveWatcher {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  notifiedAt: Date | null;
}

/**
 * One person sharing where they are, live, with one conversation: "I am on my
 * way". One row per person per conversation while it runs.
 *
 * Only the latest position is kept, never the path. The row is removed when
 * they stop, and Mongo removes it by itself at `endsAt` if they never do (a
 * phone that died mid-drive), so nothing about a drive outlives it.
 *
 * In the database rather than in memory like presence, so a deploy in the
 * middle of a drive does not end the sharing: the next position finds it here.
 */
export interface ILiveLocation extends Document {
  conversationId: string;
  groupId: string;
  /** `User._id` of the person sharing. */
  userId: string;
  name: string;
  position: ILivePosition | null;
  destination: ILiveDestination | null;
  /**
   * A pin rather than a live position: one place, marked or taken once, for
   * "come and get me here". Its phone need not stay on, so it is never old.
   */
  fixed: boolean;
  /** What a pin is: a saved place's name, or its address. */
  pinLabel: string | null;
  watchers: ILiveWatcher[];
  startedAt: Date;
  endsAt: Date;
}

const PositionSchema = new Schema<ILivePosition>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    heading: { type: Number, default: null },
    speed: { type: Number, default: null },
    at: { type: Date, required: true }
  },
  { _id: false }
);

const WatcherSchema = new Schema<ILiveWatcher>(
  {
    userId: { type: String, required: true },
    name: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radiusM: { type: Number, required: true },
    notifiedAt: { type: Date, default: null }
  },
  { _id: false }
);

const LiveLocationSchema = new Schema<ILiveLocation>(
  {
    conversationId: { type: String, required: true },
    groupId: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, default: '' },
    position: { type: PositionSchema, default: null },
    destination: {
      type: new Schema<ILiveDestination>(
        {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          label: { type: String, default: null }
        },
        { _id: false }
      ),
      default: null
    },
    fixed: { type: Boolean, default: false },
    pinLabel: { type: String, default: null },
    watchers: { type: [WatcherSchema], default: [] },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true }
  },
  { optimisticConcurrency: true }
);

LiveLocationSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
// Gone at its end time even if the phone that started it never says stop.
LiveLocationSchema.index({ endsAt: 1 }, { expireAfterSeconds: 0 });

export const LiveLocation = model<ILiveLocation>('LiveLocation', LiveLocationSchema);
