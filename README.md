<img width="1983" height="793" alt="MD Library Chalkboard Banner" src="https://github.com/user-attachments/assets/9b89a908-36a3-47f5-a4a8-0753b33fb433" />

# MD Library

# TL;DR
A library of markdown skills for Claude. Each skill is a .md file that Claude loads when a task calls for it.

Current collections:

claude-design: skills for design work with Claude.
motion-pro: motion and animation skill.
cinematic-ui-demo: cinematic product-demo / promo motion graphics, with a simulated cursor, reactive UI and a camera that pans and zooms with the action. Outputs a self-contained, screen-recordable HTML page.

Skills that ship supporting files (scripts, images) live in their own folder, with a `SKILL.md` and an `assets/` directory beside it.
```
Library-of-Mds/
├── README.md
└── claude-design/
    ├── motion-pro.md
    └── cinematic-ui-demo/
        ├── SKILL.md
        └── assets/
            ├── cursor.svg
            └── timeline-engine.js
```
# Contributing
- Fork the repo and create a branch.
- Add or edit a skill .md file in the matching folder.
- Use lowercase, hyphenated file names.
- Don't commit secrets or private data.
- Open a pull request describing what you changed and why.
