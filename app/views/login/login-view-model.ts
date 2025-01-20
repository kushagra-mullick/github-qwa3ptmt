import { Observable } from '@nativescript/core';
import { Supabase } from '../../services/supabase';

export class LoginViewModel extends Observable {
  email: string = '';
  password: string = '';
  isSignUp: boolean = false;

  async onSignIn() {
    try {
      if (this.isSignUp) {
        const { data, error } = await Supabase.auth.signUp({
          email: this.email,
          password: this.password,
        });
        if (error) throw error;
        alert('Registration successful! You can now sign in.');
        this.isSignUp = false;
      } else {
        const { data, error } = await Supabase.auth.signInWithPassword({
          email: this.email,
          password: this.password,
        });
        if (error) throw error;
        // Navigate to tasks page
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert(error.message);
    }
  }

  onToggleAuth() {
    this.isSignUp = !this.isSignUp;
    this.notifyPropertyChange('isSignUp', this.isSignUp);
  }

  onGuestAccess() {
    // Navigate to tasks page in guest mode
  }
}