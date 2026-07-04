# Cricket SaaS — User Manual

Welcome to Cricket SaaS, an IPL-style fantasy auction platform. This manual explains how to set up your league, manage players and teams, and run a live player auction with real-time bidding.

Each section below is self-contained, so feel free to jump straight to the part you need.

---

## Getting Started

### 1. Create an account

1. Go to the app's login page.
2. Click **Register**.
3. Fill in:
   - **Name** (optional)
   - **Email**
   - **Password** (must be at least 8 characters)
4. Click **Create account**.
5. You'll be signed in automatically and taken to the league setup screen.

[SCREENSHOT: register page]

### 2. Set up your league (organization)

Every auction belongs to a "league" (called an organization internally). You must create one before you can do anything else.

1. After registering, you'll land on the **Set up your league** screen.
2. Enter a **League / Organization name** (for example, "Sunday Premier League").
3. A **URL slug** is generated automatically from the name (lowercase letters, numbers, and hyphens only). You can edit it if you like.
4. Click **Create league**.
5. You're now taken to your **Dashboard**.

> **Note:** You can only create one league per account, and there is currently no way to invite other people to join your league. Each account manages its own, separate league. See [Roles & Permissions](#roles--permissions) below for what this means in practice.

[SCREENSHOT: onboarding / create league form]

### 3. Signing in later

1. Go to the login page.
2. Enter your **Email** and **Password**.
3. Click **Sign in**.

You'll be returned to your **Dashboard**.

### 4. Signing out

Click **Sign out** in the top-right corner of the header, available on any page once signed in.

### 5. Finding your way around

Once signed in, the header at the top of every page shows two links:

- **Dashboard** — an overview of your auctions.
- **Auctions** — the full list of auctions you've created.

Your account initials and email appear on the right side of the header, next to the **Sign out** link.

[SCREENSHOT: dashboard with header nav]

---

## Roles & Permissions

Cricket SaaS currently supports **one organizer per league**. Whoever creates the league (during onboarding) is the sole account with access to it.

What this means in practice:

- There are no "roles" to choose between — the person who signs in to your league's account can do everything: create and edit players and teams, set up auctions, add teams and players to an auction, run the live auction, place bids on behalf of any team, and mark players sold or unsold.
- There is no feature to invite teammates, co-organizers, or viewers into your league. If multiple people need to run the auction together, they should do so from the same signed-in browser session (for example, sharing one screen), rather than expecting separate logins with different permissions.
- Anyone who wants their own independent league needs their own separate account (their own registration and their own league setup) — leagues are not shared between accounts.

If your event needs multiple people to log in separately with different levels of access (e.g., a bidder-only view for each team), that capability does not exist yet.

---

## Managing Players

Players are added and edited from inside an auction's setup screen, not from a separate "Players" page. When you add a player, it becomes available to reuse in any future auction you create.

Some players may appear automatically with no edit option — these are shared sample players (e.g., real IPL players) provided for every league to use, and cannot be edited or deleted. Only players you create yourself can be edited or deleted.

### How to open the Players area

1. Go to **Auctions** in the header.
2. Click into an auction that is still being set up (status **DRAFT**). If you haven't created one yet, see [Running an Auction](#running-an-auction).
3. You'll see a **Players** card on the setup screen.

[SCREENSHOT: auction setup screen, Players card]

### How to add a new player

1. In the Players card, click **+ New Player**.
2. Fill in the quick-add form:
   - **Name** (required)
   - **Role** — choose Batsman, Bowler, All-Rounder, or Wicket-Keeper
   - **Base price** (required) — the minimum bidding price for this player
   - **Country** (optional)
   - **Overseas player** — check this box if the player counts as an overseas player for squad rules
   - **Avatar URL** (optional) — a web link to an image, if you don't plan to upload a photo file
3. Click **Add Player**.
4. The new player appears in the list, already checked, with a confirmation message. Check the box next to it (if not already checked) and click **Add to auction** when you're ready to include it in this auction's player pool.

[SCREENSHOT: new player quick-add form]

### How to edit a player

1. In the Players list, find the player and click the pencil icon (✎) next to their name.
   - Note: the pencil icon only appears for players your league created. Shared sample players cannot be edited.
2. Update any fields as needed.
3. Click **Save** to keep your changes, or **Cancel** to discard them.

### How to upload a player photo

1. Open the player for editing (pencil icon ✎, as above).
2. In the edit form, click the photo uploader and choose an image file (PNG, JPEG, or WEBP, up to 3MB).
3. The photo uploads automatically as soon as you select the file — you'll see **Uploading…**, and the player's photo preview updates once it's done.

> There is no separate feature for uploading player statistics (runs, wickets, averages, etc.) — only a name, role, base price, country, overseas flag, and photo can be recorded for each player.

[SCREENSHOT: player edit form with photo uploader]

### How to delete a player

1. Open the player for editing (pencil icon ✎).
2. Click **Delete**.
3. Confirm the deletion when prompted ("Delete '[player name]'? This cannot be undone.").

**Note:** You cannot delete a player who is already part of an auction's player list. Remove them from that auction first (see below), then delete them.

### How to remove a player from an auction (without deleting them)

This only works while the auction is still in **DRAFT** status (before it starts).

1. In the auction setup screen, find the player under the auction's player list.
2. Click the ✕ icon next to their name.

The player is removed from this auction only — they remain available to add to other auctions.

---

## Managing Teams

Like players, teams are created and edited from inside an auction's setup screen. A team you create is reusable across future auctions.

Some teams may appear automatically with no edit option — these are shared sample teams provided for every league, and cannot be edited or deleted.

### How to open the Teams area

1. Go to the setup screen for an auction that hasn't started yet (status **DRAFT**).
2. You'll see a **Teams** card next to (or near) the Players card.

[SCREENSHOT: auction setup screen, Teams card]

### How to add a new team

1. In the Teams card, click **+ New Team**.
2. Fill in:
   - **Name** (required)
   - **Short name** (required, up to 10 characters — shown in uppercase, e.g., "MI", "CSK")
   - **Color** — pick a color using the color picker; this is used to visually identify the team during the live auction
3. Click **Add Team**.
4. The new team appears in the list, already checked. Check it (if needed) and click **Add to auction** to include it.

[SCREENSHOT: new team quick-add form]

### How to edit a team

1. Find the team in the list and click the pencil icon (✎) next to its name.
   - Only teams your league created can be edited; shared sample teams cannot.
2. Update the Name, Short name, or Color as needed.
3. Click **Save** or **Cancel**.

### How to upload a team logo

1. Open the team for editing (pencil icon ✎).
2. In the edit form, click the logo uploader and choose an image file (PNG, JPEG, or WEBP, up to 3MB).
3. The logo uploads automatically once selected; you'll see **Uploading…** followed by the updated logo preview.

### How to delete a team

1. Open the team for editing (pencil icon ✎).
2. Click **Delete**.
3. Confirm when prompted ("Delete '[team name]'? This cannot be undone.").

**Note:** You cannot delete a team that is already part of an auction. Remove it from that auction first.

### How to remove a team from an auction (without deleting it)

This only works while the auction is in **DRAFT** status.

1. On the auction setup screen, find the team in the auction's team list.
2. Click the ✕ icon next to its name.

---

## Running an Auction

An auction moves through three real stages: **Draft** (setup), **Live** (bidding, which can be paused and resumed), and an end state once every player has been dealt with. There is no separate "Completed" button — see step 5 below for what happens at the end.

### Step 1: Create the auction

1. Click **Auctions** in the header.
2. Click **New Auction**.
3. Fill in the **New Auction** form:
   - **Auction name**
   - **Format** — choose T20, T10, or Tennis Ball
   - **Purse per team (₹)** — the budget each team starts with (defaults to 1,000,000)
   - **Max squad size** — the most players a single team can end up with (defaults to 15)
   - **Max overseas** — the most overseas players a single team can have (defaults to 4)
4. Click **Create auction**.

You're taken to the new auction's setup screen. Its status is **DRAFT**.

[SCREENSHOT: new auction form]

### Step 2: Add teams and players

While the auction is in **DRAFT** status:

1. Add or select teams in the **Teams** card and click **Add [N] team(s) to auction** (see [Managing Teams](#managing-teams)).
2. Add or select players in the **Players** card and click **Add [N] player(s) to auction** (see [Managing Players](#managing-players)). Each player added becomes a numbered "lot" to be auctioned.
3. You need **at least 2 teams and 1 player** before you can start. The **Start Auction** button stays disabled with a hint ("Need at least 2 teams and 1 player") until this is met.

[SCREENSHOT: auction setup with teams and players added, Start Auction button]

### Step 3: Start the auction

1. Once you have at least 2 teams and 1 player, click **Start Auction →**.
2. The auction status changes to **LIVE**, and you're moved into the live auction room.

### Step 4: Run the live bidding

In the live auction room, you (the auction organizer / "conductor") control the flow using these buttons:

- **Next Player →** — brings the next player up for bidding. Click this to start each new lot.
- **Pause** — pauses the auction. No bids can be placed on the current lot while paused. Use **Resume** to continue.
- **Resume** — appears only while paused; resumes the auction from where it left off.
- **Sell ✓** — sells the current player to whichever team currently has the highest bid (or a team you've selected in the bid form if no bids have been placed yet). This deducts the price from that team's purse.
- **Unsold** — marks the current player as unsold if no team wants them (or you choose not to sell), and moves on without deducting any purse.

Once you click **Sell ✓** or **Unsold**, that player's lot is finished. Click **Next Player →** to bring up the next one.

[SCREENSHOT: live auction room mid-bid]

### Step 5: Finishing the auction

There is no explicit "finish" or "complete" button. Once every player in the auction has been sold or marked unsold, clicking **Next Player →** again will show an error saying there are no more players to auction — this is your signal that the auction is effectively finished. The auction stays in **Live** status; there's no separate "completed" screen. At this point, you can review team rosters and purses in the live room, or leave the page.

---

## Participating as a Bidder

There are no separate bidder logins — everyone who wants to follow or bid in the auction views it through the same live auction room as the organizer, on the same signed-in account. Bids are placed by selecting a team and entering an amount, so in practice one person (or one shared screen) typically places bids on behalf of each team as instructed by that team's representative.

### What you see during a live auction

- **Current player on the block**: photo (or initials if no photo), name, role, country, and overseas flag.
- **Base price**: the minimum price for the current player.
- **Current bid**: the highest bid placed so far for this player, or "Waiting for first bid…" if none yet.
- **A bid feed**: a running list of every bid placed for the current player, with the team name and amount. When a player is sold, a green line reads "✓ SOLD to [team]". When marked unsold, a line reads "— UNSOLD".
- **Team panel**: every team in the auction, showing their logo/color, remaining purse, a purse progress bar, and how many players (and how many overseas players) they've bought so far. The team currently in the lead for the active bid is marked with a crown 👑.
- A celebratory animation plays when a player is sold.

[SCREENSHOT: live auction room with bid feed and team panel]

### How to place a bid

1. In the bid form (below the current player's details), choose the **team** you're bidding for from the dropdown. Each team's remaining purse is shown next to its name.
2. Enter a **bid amount**. The amount must be at least the player's base price.
3. Click **Bid**.

Your bid appears instantly in the bid feed for everyone watching, along with an animation showing the new bid amount.

### Budget and bidding rules

- A bid must be for **at least the player's base price**.
- A bid must be **strictly higher** than the current highest bid — any higher amount is accepted (there is no fixed minimum increment enforced by the app, so bid amounts are agreed upon verbally/by convention among participants).
- There is no countdown timer — a player stays open for bidding until the organizer clicks **Sell ✓** or **Unsold**.
- A team cannot exceed its remaining purse, its maximum squad size, or its maximum overseas player count (all set when the auction was created) — the platform enforces these limits when a sale is finalized.

---

## FAQ / Troubleshooting

**Q: I got disconnected / my screen froze during a live auction. What do I do?**
A: Simply refresh the page. The auction room reconnects and reloads the current state (current player, bids, and purses) from the server, so you won't lose anything that already happened — you just rejoin at the current point in the auction.

**Q: I placed a bid but nothing happened.**
A: Check that your bid amount is higher than both the player's base price and the current highest bid shown on screen. Bids that don't meet these conditions are rejected and won't appear in the bid feed.

**Q: The "Start Auction" button is greyed out. Why?**
A: You need at least 2 teams and 1 player added to the auction before it can start. Add more using the Teams and Players cards on the setup screen.

**Q: I can't edit or delete a player or team.**
A: Only players/teams your league created can be edited or deleted (look for the pencil ✎ icon). Shared sample players/teams provided to every league cannot be changed or removed.

**Q: I tried to delete a player or team and got an error about it being "used in" an auction.**
A: You must first remove that player or team from every auction they've been added to (using the ✕ icon on the auction setup screen) before you can delete them for good.

**Q: Can I invite someone else to help manage my league?**
A: Not currently. Each league is tied to a single account with no invite feature. See [Roles & Permissions](#roles--permissions).

**Q: Where do I upload player statistics like runs or wickets?**
A: This isn't supported yet. You can record a player's name, role, country, base price, overseas status, and a photo, but there's no field or upload for performance statistics.

**Q: How do I know when the auction is over?**
A: When every player has been sold or marked unsold, clicking **Next Player →** will show an error that there are no more players left. At that point, the auction is effectively complete — review final team rosters and purses in the live auction room.

**Q: Can I pause the auction if I need a break?**
A: Yes — click **Pause** at any point during a live auction. No bids can be placed while paused. Click **Resume** to continue.
