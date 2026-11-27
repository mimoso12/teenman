import {redirect} from 'next/navigation';

export default function RoomsShortcutPage() {
  redirect('/feed?view=rooms');
}
