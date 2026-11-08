# Workout App

A personal workout planning and progress-tracking application designed to help users organize their training, record workout results, and monitor their fitness progress.

## Overview

Workout App is a web-based fitness application that allows users to create and follow personalized workout plans, track completed exercises, and review their progress over time.

The application is designed with a simple interface and supports offline usage through Progressive Web App (PWA) functionality.

## Features

- **Personalized workout plans** — generate and manage workout plans based on user preferences.
- **Exercise selection** — browse and select exercises for training sessions.
- **Workout tracking** — record completed sets, repetitions, and weights.
- **Progress tracking** — review workout history and monitor performance over time.
- **Statistics and achievements** — view training activity and personal milestones.
- **Local data storage** — save workout information in the browser using LocalStorage.
- **Offline support** — access the application using service worker caching.
- **WHOOP metrics input** — manually enter fitness metrics to complement workout tracking.

## Technologies

- HTML5
- CSS3
- JavaScript (ES Modules)
- LocalStorage API
- Service Workers
- Progressive Web App (PWA)
- Web App Manifest

## Project Structure

```text
workout-app/
├── css/
│   └── style.css
├── icons/
├── js/
│   ├── app.js
│   ├── exercises.js
│   ├── plan.js
│   ├── progress.js
│   ├── store.js
│   └── workout.js
├── index.html
├── manifest.webmanifest
└── sw.js
```

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/alikhangaliyev2023-creator/workout-app.git
   ```

2. Open the project folder:

   ```bash
   cd workout-app
   ```

3. Start a local development server:

   ```bash
   python3 -m http.server 8000
   ```

4. Open the application in your browser:

   ```text
   http://localhost:8000
   ```

A local server is recommended because the application uses JavaScript modules and service workers.

## Data & Privacy

Workout information is stored locally in the user's browser using LocalStorage. The application does not require a user account for its local tracking functionality.

## Purpose

This project demonstrates practical experience with frontend development, JavaScript application architecture, browser storage, and Progressive Web App functionality.

---

**Developer:** [Alikhan Galiyev](https://github.com/alikhangaliyev2023-creator)

**Repository:** [Workout App on GitHub](https://github.com/alikhangaliyev2023-creator/workout-app)
