# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary (inferred, awaiting confirmation): people evaluating the project, such as recruiters and interviewers looking at an AI engineering portfolio piece, who need to grasp within seconds what the agent does and how it works. Secondary: people with a real research question who want a cited answer rather than a list of links.

## Product Purpose

QueryMind is an AI research agent. You give it a goal; it plans searches, runs several web searches in parallel, pauses to ask you a clarifying question when the goal is ambiguous, and streams back a synthesised answer in which every claim carries a numbered citation to a source card. Success is a trustworthy, cited answer with as little back-and-forth as the question allows.

## Positioning

A research agent that asks before it guesses. The human-in-the-loop pause is the mechanism a plain chat-with-search product does not have; parallel search and inline citations make the result checkable.

## Operating Context

React + Vite frontend, FastAPI backend streaming Server-Sent Events, Gemma via the Gemini API, Tavily search, MCP server, Redis-backed session persistence. Google sign-in or anonymous use. Sessions are saved and can be reopened from the history sidebar; follow-up questions continue a session.

## Capabilities and Constraints

- Stream events: searching, source_found, reasoning, pause (clarifying question), done, error.
- History: list, open, delete sessions.
- No pricing, customers, testimonials or benchmarks exist; none may be invented.

## Brand Commitments

Name: QueryMind. Friendly mascot requested by the owner: a soft glowing "thought" creature that splits into copies to show parallel search (direction proposed, pending confirmation).

## Evidence on Hand

- Demo videos linked in README.md; `frontend/public/Hero.mp4`.
- No testimonials, logos, usage numbers or press. Do not fabricate them.

## Product Principles

1. Show the mechanism, not adjectives: let visitors watch the agent search, pause and cite.
2. Every answer is checkable; sources stay visible beside the answer.
3. The agent asks rather than guesses; the clarifying question is a feature, not an interruption.
4. Friendly, never childish: the mascot makes an autonomous system feel approachable.

## Accessibility & Inclusion

WCAG AA contrast; full keyboard use; respect `prefers-reduced-motion` (scroll animation and 3D must have a calm fallback).
