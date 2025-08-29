
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { User, Role } from '@/types';

export interface AuthUser extends Omit<User, 'passwordHash' | 'role'> {
  role?: Role;
}

interface AuthState {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      state.status = 'succeeded';
      state.error = null;
    },
    clearUser: (state) => {
      state.user = null;
      state.status = 'idle';
      state.error = null;
    },
    setAuthLoading: (state) => {
      state.status = 'loading';
    },
    setAuthError: (state, action: PayloadAction<string>) => {
        state.status = 'failed';
        state.error = action.payload;
        state.user = null;
    }
  },
});

export const { setUser, clearUser, setAuthLoading, setAuthError } = authSlice.actions;

export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectAuthError = (state: RootState) => state.auth.error;

export default authSlice.reducer;
