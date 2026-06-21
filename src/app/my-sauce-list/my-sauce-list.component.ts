import { Component, OnInit } from '@angular/core';
import { SaucesService } from '../services/sauces.service';
import { catchError, Observable, of, tap } from 'rxjs';
import { Sauce } from '../models/Sauce.model';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-my-sauce-list',
  templateUrl: './my-sauce-list.component.html',
  styleUrls: ['./my-sauce-list.component.scss']
})
export class MySauceListComponent implements OnInit {

  sauces$!: Observable<Sauce[]>;
  loading!: boolean;
  errorMsg!: string;

  constructor(private sauceService: SaucesService,
              private router: Router) { }

  ngOnInit() {
    this.loading = true;
    this.sauces$ = this.sauceService.sauces$.pipe(
      tap(() => {
        this.loading = false;
        this.errorMsg = '';
      }),
      catchError(error => {
        this.errorMsg = JSON.stringify(error);
        this.loading = false;
        return of([]);
      })
    );
    this.sauceService.getUserSauces();
  }

  onClickSauce(id: string) {
    this.router.navigate(['sauce', id]);
  }

}
