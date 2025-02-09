# Streamsor Project Overview

## Purpose
A streaming platform built with Expo/React Native that allows users to:
- Watch live streams
- Create and broadcast streams
- View recorded videos
- Manage their channel

## Tech Stack
- Frontend: Expo/React Native
- Authentication: Firebase Auth
- Database: Firebase Firestore/Realtime DB
- Storage: Firebase Storage
- Media Server: Custom Node.js server
- Hosting: Firebase Hosting

## Key Features
- User authentication (login/signup)
- Live streaming capabilities
- Video playback
- Channel management
- Chat functionality

## Architecture
- `/app`: Main application code using Expo Router for navigation
- `/server`: Media server implementation
- `/functions`: Firebase Cloud Functions
- File-based routing with Expo Router
- Tab-based navigation for main sections

## Development Guidelines
- Use TypeScript for type safety
- Follow React Native Paper design system
- Firebase for backend services
- Expo for cross-platform development

## Important URLs
- Firebase Console: TBD (need project URL)
- Expo Documentation: https://docs.expo.dev
- React Native Paper: https://callstack.github.io/react-native-paper/

## Work in Progress
- Media server implementation
- Video storage and playback
- Stream chat integration
