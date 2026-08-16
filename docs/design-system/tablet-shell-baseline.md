# Tablet shell baseline

Status: accepted working direction

The existing PHOENIX shell is the baseline rather than a redesign target. Its stable structure is:

1. a top bar with product identity and compact square utility controls;
2. horizontal primary navigation immediately below the top bar;
3. a narrow contextual rail using icons or recognizable three-letter labels;
4. one scrolling page-content workspace;
5. bottom workspace navigation for Controls, Info, and Copilot.

The top bar, primary navigation, bottom workspace navigation, logo cell, home cell, and contextual
rail form one continuous outer-shell structure. They all use `--application-shell-chrome-size`; individual
rows and cells must not redefine those dimensions.

The primary target is a tablet, especially landscape orientation. Portrait and smaller bounded
regions must remain functional through horizontal navigation scrolling and container-based sizing,
but they do not redefine the shell as a website sidebar or hamburger menu.

Top-right utility controls still need refinement. Until their hierarchy and final icon set are
settled, they keep the current square geometry, accessible full labels, and short visible symbols.
This uncertainty does not justify changing the rest of the shell.

The design-system effort should concentrate on page composition inside the workspace: consistent
headers, open sections, adaptive grids, forms, lists, tables, dashboard widgets, and unique game
tools. Shell changes require a concrete tablet usability problem rather than general web-layout
fashion.

The shell is composed rather than configured as one monolith: `TopBar`, optional `PrimaryBar`,
`Workspace` with optional `Rail` plus `Content`, and optional `BottomBar` are direct children of
`ApplicationShell`. Showing or hiding a bar means adding or
removing that component from the JSX stack; it never requires rewriting a grid template.
