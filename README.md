# Yupp Quiz

A Kahoot-style multiplayer quiz game built with Bun and PeerJS. Deploy to GitHub Pages with zero backend required.

## Features

- Real-time multiplayer quiz gameplay
- No backend server needed (peer-to-peer using PeerJS)
- Easy quiz creation with JSON files
- Score calculation with speed bonuses
- Live leaderboards
- Responsive design
- Deployable to GitHub Pages

## Quick Start

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

Then open `http://localhost:3000` in your browser.

### Build for Production

```bash
bun run build
```

This creates a `dist/` folder with all static files ready for deployment.

### Preview Production Build

```bash
bun run preview
```

## Creating Quizzes

Create JSON files in the `quizzes/` directory. Example format:

```json
{
  "title": "Your Quiz Title",
  "description": "Quiz description",
  "timePerQuestion": 20,
  "questions": [
    {
      "question": "What is 2+2?",
      "answers": ["3", "4", "5", "6"],
      "correctAnswer": 1,
      "points": 1000
    }
  ]
}
```

- `timePerQuestion`: seconds per question
- `correctAnswer`: 0-indexed array position of correct answer
- `points`: base points for correct answer (speed bonus added automatically)

## How to Play

### Host a Game

1. Click "Host Game"
2. Select a quiz from the dropdown
3. Click "Create Game"
4. Share the 6-digit PIN with players
5. Wait for players to join
6. Click "Start Game" when ready

### Join a Game

1. Click "Join Game"
2. Enter your name
3. Enter the 6-digit game PIN
4. Wait in lobby for host to start
5. Answer questions as fast as possible for bonus points

## Deployment to GitHub Pages

### Option 1: Manual Deployment

1. Build the project:
```bash
bun run build
```

2. Push the `dist/` folder to a `gh-pages` branch:
```bash
cd dist
git init
git add .
git commit -m "Deploy to GitHub Pages"
git branch -M gh-pages
git remote add origin YOUR_REPO_URL
git push -f origin gh-pages
```

3. Enable GitHub Pages in repository settings, select `gh-pages` branch

### Option 2: Automatic Deployment with GitHub Actions

The included workflow file automatically deploys to GitHub Pages on every push to main.

1. Push this repo to GitHub
2. Go to Settings > Pages
3. Set Source to "GitHub Actions"
4. Push to main branch - auto-deploys

Your quiz will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## Project Structure

```
yupp/
├── src/
│   ├── index.html       # Main HTML file
│   ├── app.ts           # Application logic
│   └── styles/
│       └── main.css     # Styling
├── quizzes/
│   └── example-quiz.json # Sample quiz
├── dist/                # Build output (generated)
└── package.json
```

## Technology Stack

- **Bun**: JavaScript runtime and bundler
- **PeerJS**: WebRTC peer-to-peer connections
- **Vanilla JS**: No framework dependencies
- **CSS3**: Modern responsive design

## Scoring System

- Base points per question (defined in quiz JSON)
- Speed bonus: up to +500 points based on answer speed
- Faster answers = higher scores
- Incorrect answers = 0 points

## Browser Support

Works in all modern browsers that support WebRTC:
- Chrome/Edge 56+
- Firefox 44+
- Safari 11+

## Troubleshooting

**Players can't connect to host:**
- Ensure both are on stable internet connections
- Check firewall settings aren't blocking WebRTC
- Try refreshing both host and player pages

**Quiz not loading:**
- Verify JSON syntax is valid
- Check quiz file is in `quizzes/` directory
- Ensure file path in quiz selector matches actual file

**Build fails:**
- Run `bun install` to ensure dependencies are installed
- Check Bun version: `bun --version` (should be 1.0+)

## Adding More Quizzes

1. Create new `.json` file in `quizzes/` directory
2. Follow the quiz format structure
3. Rebuild: `bun run build`
4. Quiz automatically appears in host selection

## License

MIT

## Contributing

Pull requests welcome. For major changes, open an issue first to discuss proposed changes.
