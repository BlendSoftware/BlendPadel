import { createBrowserRouter, Navigate } from 'react-router-dom'
import { NotFoundPage } from '@/features/auth/NotFoundPage'
import { AppShell } from '@/components/layout/AppShell'
import { PrivateRoute } from './PrivateRoute'

// Auth pages
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { OnboardingPage } from '@/features/auth/OnboardingPage'
import { OnboardingResultPage } from '@/features/auth/OnboardingResultPage'
import { ChangePasswordScreen } from '@/features/auth/ChangePasswordScreen'

// Feature pages
import { RadarPage } from '@/features/radar/RadarPage'
import { MatchmakingPage } from '@/features/matchmaking/MatchmakingPage'
import { RankingsPage } from '@/features/rankings/RankingsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { EditProfilePage } from '@/features/profile/EditProfilePage'
import { AvatarUploadPage } from '@/features/profile/AvatarUploadPage'
import { PreferencesPage } from '@/features/profile/PreferencesPage'
import { PublicProfilePage } from '@/features/profile/PublicProfilePage'

// Venues
import { VenuesPage } from '@/features/venues/VenuesPage'
import { CreateVenuePage } from '@/features/venues/CreateVenuePage'

// Partnerships
import { PartnershipsPage } from '@/features/partnerships/PartnershipsPage'

// Feed
import { FeedPage } from '@/features/feed/FeedPage'

// Matchmaking + match lifecycle
import { MatchDetailPage } from '@/features/matchmaking/MatchDetailPage'
import { CreateFlarePage } from '@/features/matchmaking/screens/CreateFlarePage'
import { RespondFlarePage } from '@/features/matchmaking/screens/RespondFlarePage'
import { CreateMatchPage } from '@/features/matchmaking/screens/CreateMatchPage'
import { SubmitResultPage } from '@/features/matchmaking/screens/SubmitResultPage'
import { ConfirmDisputePage } from '@/features/matchmaking/screens/ConfirmDisputePage'

export const router = createBrowserRouter([
  // ── 404 catch-all ────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFoundPage />,
  },

  // ── Public routes ─────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  // Onboarding is outside PrivateRoute to avoid circular redirect when
  // user is authenticated but onboarding_completed = false
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    path: '/onboarding/result',
    element: <OnboardingResultPage />,
  },
  // Change password is auth-checked internally (redirects to /login if needed)
  {
    path: '/change-password',
    element: <ChangePasswordScreen />,
  },

  // ── Protected routes (require auth + completed onboarding) ────────────────
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to="/radar" replace />,
          },
          {
            path: '/radar',
            element: <RadarPage />,
          },
          // ── Matchmaking (Tab 2) ──────────────────────────────────────────
          {
            path: '/matchmaking',
            element: <MatchmakingPage />,
          },
          {
            path: '/matchmaking/create-flare',
            element: <CreateFlarePage />,
          },
          {
            path: '/matchmaking/flares/:id/respond',
            element: <RespondFlarePage />,
          },
          {
            path: '/matchmaking/new',
            element: <CreateMatchPage />,
          },
          // ── Match lifecycle ──────────────────────────────────────────────
          {
            path: '/matches/:id',
            element: <MatchDetailPage />,
          },
          {
            path: '/matches/:id/result',
            element: <SubmitResultPage />,
          },
          {
            path: '/matches/:id/confirm',
            element: <ConfirmDisputePage />,
          },
          // ── Profile ──────────────────────────────────────────────────────
          {
            path: '/rankings',
            element: <RankingsPage />,
          },
          // ── Venues ──────────────────────────────────────────────────────
          {
            path: '/venues',
            element: <VenuesPage />,
          },
          {
            path: '/venues/new',
            element: <CreateVenuePage />,
          },
          // ── Partnerships ────────────────────────────────────────────────
          {
            path: '/partnerships',
            element: <PartnershipsPage />,
          },
          // ── Feed ────────────────────────────────────────────────────────
          {
            path: '/feed',
            element: <FeedPage />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
          {
            path: '/profile/edit',
            element: <EditProfilePage />,
          },
          {
            path: '/profile/avatar',
            element: <AvatarUploadPage />,
          },
          {
            path: '/profile/preferences',
            element: <PreferencesPage />,
          },
          {
            path: '/profile/:id',
            element: <PublicProfilePage />,
          },
        ],
      },
    ],
  },
])
