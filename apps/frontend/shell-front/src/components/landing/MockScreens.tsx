/**
 * The three screens the showcase shows: a month of the journal, a chat, and
 * the album. They are the app's own layout and the app's own module colours,
 * drawn at PhoneFrame's fixed canvas size and filled with sample data.
 *
 * Drawn rather than photographed because the only real screens Tumbaland has
 * are somebody's evenings, somebody's messages and somebody's holiday, and
 * none of that belongs on a public page. The sample data is plausible and it
 * is labelled as sample under the phones.
 *
 * Each screen animates once, when it first comes into view, and is passed
 * `playing` rather than owning that: three screens sharing one observer land
 * together instead of trickling in as each crosses the line.
 */
export { JournalScreen } from './mockScreens/JournalScreen';
export { ChatScreen } from './mockScreens/ChatScreen';
export { AlbumScreen } from './mockScreens/AlbumScreen';
