import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InsightsService } from './insights.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['./feedback.page.scss'],
  template: `
    <div class="feedback-wrap">
      <div class="feedback-intro">
        <span class="feedback-kicker">Your voice matters</span>
        <h1>Help shape the next KasiDrop.</h1>
        <p>
          We are building a better way to shop local in South Africa. What worked well, and what
          could be better?
        </p>
        <p>
          Tell us about your experience. Please do not share passwords, phone numbers, delivery
          addresses or payment information.
        </p>
      </div>
      <section class="feedback-card" aria-labelledby="feedback-title">
        <h2 id="feedback-title">Share your feedback</h2>
        <form #feedbackForm="ngForm" (ngSubmit)="submit()" novalidate>
          <label class="feedback-field" for="kind">
            <span>What is this about?</span>
            <select id="kind" name="kind" [(ngModel)]="category" required>
              <option value="experience">My shopping experience</option>
              <option value="bug">Something is not working</option>
              <option value="idea">I have an idea</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label class="feedback-field" for="rating">
            <span>How would you rate KasiDrop? (Optional)</span>
            <select id="rating" name="rating" [(ngModel)]="rating">
              <option [ngValue]="undefined">Prefer not to rate</option>
              <option *ngFor="let n of [5, 4, 3, 2, 1]" [ngValue]="n">{{ n }} out of 5</option>
            </select>
          </label>
          <label class="feedback-field" for="message">
            <span>Your feedback</span>
            <textarea
              id="message"
              name="message"
              [(ngModel)]="message"
              #messageControl="ngModel"
              required
              minlength="10"
              maxlength="1500"
              placeholder="Tell us what you liked or what we could improve..."
              rows="6"
            ></textarea>
            <small class="feedback-hint">{{ message.length }} / 1500 characters · Minimum 10</small>
          </label>
          <button
            class="feedback-submit"
            type="submit"
            [disabled]="busy || feedbackForm.invalid || message.trim().length < 10"
          >
            {{ busy ? 'Sending your feedback…' : 'Send feedback' }}
          </button>
        </form>
        <p
          *ngIf="result"
          class="feedback-result"
          [class.error]="failed"
          role="status"
          aria-live="polite"
        >
          {{ result }}
        </p>
      </section>
    </div>
  `,
})
export class FeedbackPage {
  private readonly insights = inject(InsightsService);
  category: 'bug' | 'idea' | 'experience' | 'other' = 'experience';
  rating: number | undefined;
  message = '';
  busy = false;
  failed = false;
  result = '';
  submit() {
    if (this.busy || this.message.trim().length < 10 || this.message.length > 1500) return;
    this.busy = true;
    this.failed = false;
    this.result = '';
    this.insights
      .sendFeedback({ category: this.category, rating: this.rating, message: this.message.trim() })
      .subscribe({
        next: () => {
          this.result = 'Thank you! Your feedback has been received.';
          this.message = '';
          this.rating = undefined;
          this.busy = false;
        },
        error: () => {
          this.failed = true;
          this.result = 'We could not send your feedback. Please try again.';
          this.busy = false;
        },
      });
  }
}
