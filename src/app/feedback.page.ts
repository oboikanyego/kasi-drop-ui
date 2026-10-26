import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InsightsService } from './insights.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section style="max-width:640px;margin:3rem auto;padding:1.5rem">
      <h1>Help us improve KasiDrop</h1>
      <p>Found a bug, have an idea, or want to share your shopping experience? Your feedback goes directly to our team. Please do not include passwords, addresses or payment details.</p>
      <form (ngSubmit)="submit()">
        <label for="kind">Feedback type</label>
        <select id="kind" name="kind" [(ngModel)]="category" style="display:block;width:100%;padding:.75rem;margin:.5rem 0 1rem">
          <option value="experience">Shopping experience</option><option value="bug">Report a bug</option>
          <option value="idea">Suggestion</option><option value="other">Other</option>
        </select>
        <label for="rating">Rating (optional)</label>
        <select id="rating" name="rating" [(ngModel)]="rating" style="display:block;width:100%;padding:.75rem;margin:.5rem 0 1rem">
          <option [ngValue]="undefined">Not selected</option>
          <option *ngFor="let n of [1,2,3,4,5]" [ngValue]="n">{{n}} / 5</option>
        </select>
        <label for="message">Your feedback</label>
        <textarea id="message" name="message" [(ngModel)]="message" required minlength="10" maxlength="1500" rows="6" style="display:block;width:100%;padding:.75rem;margin:.5rem 0 1rem"></textarea>
        <button type="submit" [disabled]="busy || message.trim().length < 10" style="padding:.8rem 1.5rem;border-radius:.5rem">{{busy ? 'Sending…' : 'Send feedback'}}</button>
      </form>
      <p *ngIf="result" role="status">{{result}}</p>
    </section>
  `,
})
export class FeedbackPage {
  private readonly insights = inject(InsightsService);
  category: 'bug' | 'idea' | 'experience' | 'other' = 'experience';
  rating: number | undefined;
  message = '';
  busy = false;
  result = '';
  submit() {
    if (this.busy || this.message.trim().length < 10) return;
    this.busy = true;
    this.result = '';
    this.insights.sendFeedback({ category: this.category, rating: this.rating, message: this.message.trim() }).subscribe({
      next: () => { this.result = 'Thank you! Your feedback was received.'; this.message = ''; this.busy = false; },
      error: () => { this.result = 'Could not send feedback. Please try again.'; this.busy = false; },
    });
  }
}
