import { Injectable } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'theme';

// Light / dark mode using Bootstrap 5.3 color modes (data-bs-theme on <html>)
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // index.html already applied the saved theme before Angular started, so read it from <html>
  theme: Theme = document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';

  get isDark(): boolean {
    return this.theme === 'dark';
  }

  toggle(): void {
    this.setTheme(this.isDark ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }
}
