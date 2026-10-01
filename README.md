# Lake Effect Book Club ~ Home Page

Six files, no folders, no Google Sheet needed. Upload all six to the top level of your GitHub repository (replace the old index.html and style.css when GitHub asks). Your old app.js, store.js, seed.js and config.js aren't used anymore, so you can delete them.

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
