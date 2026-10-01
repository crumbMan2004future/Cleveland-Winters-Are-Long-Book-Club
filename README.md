# Lake Effect Book Club ~ Home Page

Seven files, no folders. Upload all seven to the top level of your GitHub repository (replace the old index.html and style.css when GitHub asks). Your old app.js, store.js, seed.js and config.js aren't used anymore, so you can delete them.

## How to edit (on GitHub)

Open **index.html** on GitHub, click the pencil icon, and use Ctrl+F (Cmd+F on a Mac) to search for the word **EDIT**. Each spot has instructions right next to it.

**Members.** Search for `EDIT THE MEMBER LIST`. One person per line:

    <li>Jane Doe</li>
    <li>John Smith</li>

Copy a line, paste it, change the name. Delete the four "Member Name" placeholder lines.

**Next meeting.** Search for `EDIT THE NEXT MEETING`. Change two things: the words people see, and the date inside `datetime="..."` (that's what powers the countdown). Use the format `2026-11-05T19:00` (year-month-day, then T, then 24-hour time).

**The book.** The Stoner section is just below the meeting. To change books next month, edit the title, author and description there.

**Webmaster name.** Search for `Mrs. Kowalski` (it's in index.html and once in game.js for the certificate signature).

When you're done, click **Commit changes**. The site updates in a minute or two.

## Pizza Pages

- The computer picks a public domain classic. You read it; the pizza bakes. 5 minutes of reading = done.
- Anti-cheat: you can't flip a page faster than about 390 words per minute, time stops counting if you sit on one page way too long, and the timer pauses if you leave the window.
- Then a 3-question fill-in-the-blank pop quiz built from the pages you actually read. 2 of 3 earns a slice. 8 slices = a whole pizza and a printable certificate.
- Slices are saved in each person's own browser (there's no shared leaderboard).
- Want to try it fast? Add `#pizzatest` to the end of the address and reload: 15-second rounds, nothing saved.
- Add more books in **library.js**: copy one `{ ... }` block and paste in any public domain text.

## Reading Notes setup (one time, about 10 minutes)

Notes are written in a Google Form, saved in a Google Sheet, and shown on the site guestbook-style.

**1. Make the form.** Go to forms.google.com and start a blank form. Add these questions (the wording can vary a little):

- **Your name**: Short answer, not required
- **Your thoughts**: Paragraph, required
- **How far in are you?**: Multiple choice (Just started / About a quarter / Halfway / Three-quarters / Finished), not required
- **Spoilers?**: Checkboxes with one option, "Yes, this has spoilers", not required

**2. Check two settings** (Settings tab, Responses section). These matter, because the responses become public on your site:

- **Collect email addresses: Do not collect.** Otherwise people's emails would be published.
- **Limit to 1 response: off**, so nobody has to sign in to Google.

**3. Connect a Sheet.** Responses tab → **Link to Sheets** → create a new spreadsheet.

**4. Publish the Sheet as CSV.** In that spreadsheet: File → Share → **Publish to web**. Pick the **Form Responses 1** tab (not "Entire document") and **Comma-separated values (.csv)**, click Publish, and copy the link.

**5. Get the form's link.** Back in the form, click **Publish** if you see that button, then copy the responder link (the Send button → link icon also works).

**6. Paste both links into index.html.** Search for `EDIT READING NOTES SETUP` and replace the two PASTE-... placeholders, keeping the quote marks around each link.

## Finishing a book (Hall of Fame)

In index.html, search for `EDIT BOOK HISTORY`. Every book gets one line, newest at the top:

    <li data-start="2026-11-05" data-author="Susanna Clarke" data-rating="" data-verdict="">Piranesi</li>
    <li data-start="2026-09-01" data-author="John Williams" data-rating="4.5" data-verdict="Quietly devastating.">Stoner</li>

When the club finishes a book:

1. On that book's line, fill in `data-rating` (out of 5, halves OK, or something like 8/10) and, if you like, a one-line `data-verdict`. Don't use double quote marks inside the verdict.
2. Add the next book as a new line at the top, with the day you started it.

The finished book moves into the Hall of Fame with its dates, gold-star rating, verdict and every note people left. The Reading Notes section switches to the new book. Notes are filed under whichever book was current on the day they were written. Also update the Book of the Month section for the new book.

**Good to know:** new notes take about 5 minutes to appear (that's Google, not you). To remove a note, delete its row in the spreadsheet.
