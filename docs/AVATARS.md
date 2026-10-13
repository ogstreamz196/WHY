# Avatars, dress-up and drops

Players build their own avatar in the Store's **Avatar Studio**. They pick a character (animals, monsters, robots, funny faces and more) and dress it up in six slots:

| Slot | Examples |
|---|---|
| Hat | caps, top hat, pizza hat, golden crown, flame hair |
| Face | specs, shades, googly eyes, goggles, theatre mask |
| Hands | flowers, lollipop, magic wand, shield, swords, trident |
| Bling | tie, beads, lei, medal, gem ring, diamond |
| Pet | snail, chick, puppy, parrot, mini dragon |
| Aura | a glow with floating sparkles, hearts, snow or fire |

Tapping any item tries it on first, so players can see the look before spending coins. Owned items can be put on and taken off at any time. The dressed avatar shows on the home page player card, the profile page, the Ranks page (podium, rows and "around you") and the player card that opens from the Ranks page.

Everything is cosmetic and bought with coins earned by playing. Coins can't be bought, so none of this can be paid for with money. Plus members also get the Plus-only characters and themes.

## Special drops

Some items can't be bought at all. They arrive as free gifts:

- **Weekly drop.** Every Monday (UTC) a different special item can be claimed once, from the home page card or the Store. It opens with a mystery-box reveal.
- **Daily Challenge reward.** Finishing the Daily Challenge gives the usual 25 coins and a mystery box. Usually it holds a few bonus coins (5 to 30); about a third of the time it holds a wearable or, more rarely, a special drop the player doesn't own yet.

These rewards are free and only earned by playing. They are never sold, as the store rules and `AGENTS.md` require. For signed-in players the server decides the reward; guests keep theirs on the device.

## Daily Challenge

The player reads the whole fact first, with the question, the answer and the fun fact on screen. The "quiz me" button unlocks after a reading pause based on the length of the text (5 to 15 seconds, about three words a second), and a "Read again" button lets them go back. The question is multiple choice with no timer, and wrong answers can be retried.

## For developers

- The catalog is in `src/lib/avatarItems.ts` (new items) and `src/lib/store.ts` (`STORE_CATALOG`, which includes them). Add an item by adding a line to the right list there. Drop items have `dropOnly: true`.
- The weekly rotation, daily reward roll and outfit cleaning are pure functions in `avatarItems.ts`, with tests in `avatarItems.test.ts`.
- `src/components/AvatarFigure.tsx` draws a dressed avatar at any size. `RewardReveal.tsx` is the mystery-box reveal.
- Outfits are stored in `profiles.avatar_outfit` (migration `20261014000000_avatar_outfits.sql`). Only the server may change it: `updateMyProfile` checks the player owns each item before saving. Purchases and gifts both go through `purchase_item`, so `user_inventory` lists everything a player owns.
- Until the migration is applied, avatars show without outfits and saving an outfit shows "Outfits can't be saved right now". Buying items and the drops still work.
