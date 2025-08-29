
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, setAuthLoading, setAuthError, selectCurrentUser, selectAuthStatus, clearUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { loginAction, registerCompanyAdminAction } from '@/app/actions/authActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, Building, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const RegisterSchema = z.object({
  companyName: z.string().min(3, 'Company name must be at least 3 characters.'),
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof LoginSchema>;
type RegisterFormData = z.infer<typeof RegisterSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch: AppDispatch = useDispatch();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('login');
  
  useEffect(() => {
    dispatch(clearUser());
  }, [dispatch]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: 'admin', password: 'admin' },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { companyName: '', username: '', password: '', confirmPassword: '' },
  });

  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const authStatus = useSelector(selectAuthStatus);
  const [isRegistering, setIsRegistering] = useState(false);


  const onLoginSubmit = async (data: LoginFormData) => {
    setLoginError(null);
    dispatch(setAuthLoading());

    try {
        const result = await loginAction(data);
        if (result.success && result.user) {
          dispatch(setUser(result.user));
          toast({ title: 'Login Successful', description: `Welcome, ${result.user.username}!` });
          router.push('/');
        } else {
          const errorMessage = result.error || 'An unknown error occurred.';
          setLoginError(errorMessage);
          dispatch(setAuthError(errorMessage));
          toast({ title: 'Login Failed', description: errorMessage, variant: 'destructive' });
        }
    } catch (e: any) {
        const errorMessage = e.message || "A critical error occurred during login.";
        setLoginError(errorMessage);
        dispatch(setAuthError(errorMessage));
        toast({ title: 'Login Failed', description: errorMessage, variant: 'destructive' });
    }
  };

  const onRegisterSubmit = async (data: RegisterFormData) => {
    setRegisterError(null);
    registerForm.clearErrors();
    setIsRegistering(true);
    
    try {
      const result = await registerCompanyAdminAction(data);
      if (result.success) {
        toast({ title: 'Registration Successful', description: result.message });
        setActiveTab('login'); // Switch to login tab on success
        loginForm.reset({ username: data.username, password: '' });
      } else {
        setRegisterError(result.message);
        toast({ title: 'Registration Failed', description: result.message, variant: 'destructive' });
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            registerForm.setError(field as keyof RegisterFormData, {
              type: 'server',
              message: (messages as string[])[0],
            });
          });
        }
      }
    } catch (e: any) {
      const errorMessage = e.message || "A critical error occurred during registration.";
      setRegisterError(errorMessage);
      toast({ title: 'Registration Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsRegistering(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm mx-auto bg-card border-border shadow-2xl rounded-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login"><LogIn className="mr-2 h-4 w-4" />Login</TabsTrigger>
            <TabsTrigger value="register"><UserPlus className="mr-2 h-4 w-4" />Register</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-primary flex items-center justify-center">
                <LogIn className="mr-3 h-7 w-7" />
                POS Login
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Please enter your credentials to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                {loginError && (<div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{loginError}</div>)}
                <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" type="text" placeholder="Enter your username" {...loginForm.register('username')} className="bg-input border-border focus:ring-primary" disabled={authStatus === 'loading'}/>{loginForm.formState.errors.username && <p className="text-xs text-destructive mt-1">{loginForm.formState.errors.username.message}</p>}</div>
                <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" placeholder="Enter your password" {...loginForm.register('password')} className="bg-input border-border focus:ring-primary" disabled={authStatus === 'loading'}/>{loginForm.formState.errors.password && <p className="text-xs text-destructive mt-1">{loginForm.formState.errors.password.message}</p>}</div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={authStatus === 'loading'}>{authStatus === 'loading' ? 'Logging in...' : 'Login'}</Button>
              </form>
            </CardContent>
          </TabsContent>

          <TabsContent value="register">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-primary flex items-center justify-center">
                <Building className="mr-3 h-7 w-7" />
                Register New Company
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Create a new company and an admin account.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                {registerError && (<div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{registerError}</div>)}
                <div className="space-y-2"><Label htmlFor="companyName">Company Name*</Label><Input id="companyName" {...registerForm.register('companyName')} placeholder="Your Company (Pvt) Ltd" className="bg-input border-border focus:ring-primary" disabled={isRegistering}/>{registerForm.formState.errors.companyName && <p className="text-xs text-destructive mt-1">{registerForm.formState.errors.companyName.message}</p>}</div>
                <div className="space-y-2"><Label htmlFor="reg-username">Admin Username*</Label><Input id="reg-username" {...registerForm.register('username')} placeholder="e.g., john.doe" className="bg-input border-border focus:ring-primary" disabled={isRegistering}/>{registerForm.formState.errors.username && <p className="text-xs text-destructive mt-1">{registerForm.formState.errors.username.message}</p>}</div>
                <div className="space-y-2"><Label htmlFor="reg-password">Password*</Label><Input id="reg-password" type="password" {...registerForm.register('password')} placeholder="Min. 6 characters" className="bg-input border-border focus:ring-primary" disabled={isRegistering}/>{registerForm.formState.errors.password && <p className="text-xs text-destructive mt-1">{registerForm.formState.errors.password.message}</p>}</div>
                <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm Password*</Label><Input id="confirmPassword" type="password" {...registerForm.register('confirmPassword')} placeholder="Re-type your password" className="bg-input border-border focus:ring-primary" disabled={isRegistering}/>{registerForm.formState.errors.confirmPassword && <p className="text-xs text-destructive mt-1">{registerForm.formState.errors.confirmPassword.message}</p>}</div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isRegistering}>{isRegistering ? 'Registering...' : 'Register Company'}</Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

    