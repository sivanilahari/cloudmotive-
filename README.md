# PDF Findings Dashboard

A split-screen React experience (Create React App) that renders the Maersk Q2 2025 Interim Report PDF on the left and an analyst summary, findings, and supporting evidence on the right. Each finding links to page coordinates inside the PDF and triggers a highlight pulse.

## Run locally

```bash
npm install
npm start
```

The development server runs on `http://localhost:3000`.

## Build for production

```bash
npm run build
```

Static assets are emitted to the `build/` folder.

## Customising the insights

Open `src/App.js` and edit:

- `analysisPoints` – top-level narrative bullets.
- `initialFindings` – each entry needs an `id`, `title`, `description`, `pageNumber`, and `yPercent` (0 = top, 1 = bottom) to position the highlight.
- `supportingEvidence` – quoted passages with their PDF locations.

If you need to swap the PDF, drop the file into `public/` and either reuse the existing filename (`Maersk Q2 2025 Interim Report.pdf`) or update `PDF_URL` in `src/App.js`.
