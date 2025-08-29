import { configureStore } from '@reduxjs/toolkit';
import saleReducer from './slices/saleSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    sale: saleReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      // Ignore these action types
      ignoredActions: ['auth/setUser'],
      // Ignore these field paths in all actions
      ignoredActionPaths: ['payload.createdAt', 'payload.updatedAt', 'payload.date', 'payload.role.permissions'],
      // Ignore these paths in the state
      ignoredPaths: ['auth.user.createdAt', 'auth.user.updatedAt', 'auth.user.role.permissions'],
    },
  }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
