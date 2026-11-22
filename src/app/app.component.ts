import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalAutoTranslateService } from './plugins/language-plugin';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'customerWebsite';
  private globalAutoTranslate = inject(GlobalAutoTranslateService);

  ngOnInit(): void {
    this.globalAutoTranslate.startGlobalAutoTranslate();
  }
}
