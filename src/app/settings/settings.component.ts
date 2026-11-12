import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemePickerComponent } from '../shared/theme-picker.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings',
  imports: [RouterLink, ThemePickerComponent],
  templateUrl: './settings.component.html'
})
export class SettingsComponent {}
