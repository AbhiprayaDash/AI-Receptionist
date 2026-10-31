# Testing

Run `npm test` for language, confirmation, and provider capability tests. Run `npm run typecheck` and `npm run build` before merging.

For a manual end-to-end text test, start PostgreSQL, migrate and seed, then start the API and web app. Choose a language in **AI Receptionist**, enter a name, a 10–15 digit phone number, select service `1`, choose a future working date in `YYYY-MM-DD`, and enter one of the offered 24-hour times. Confirm that the appointment appears under **Calendar** and the generated message appears under **Notifications** with `SIMULATED · NOT DELIVERED`.

Repeat in English, Hindi, and Odia. These runs validate text behavior only. They do not establish speech recognition or synthesis quality.
