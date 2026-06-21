import { Component, OnInit } from '@angular/core';
import { SaucesService } from '../services/sauces.service';
import { catchError, Observable, of, tap, throwError } from 'rxjs';
import { Sauce } from '../models/Sauce.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sauce-list',
  templateUrl: './sauce-list.component.html',
  styleUrls: ['./sauce-list.component.scss']
})
export class SauceListComponent implements OnInit {

  sauces$!: Observable<Sauce[]>;
  loading!: boolean;
  errorMsg!: string;

  constructor(private SaucesService: SaucesService,
              private router: Router) { }

  ngOnInit() {
    this.loading = true;
    this.sauces$ = this.SaucesService.getAllSauces().pipe(
          tap(() => {
            this.loading = false
          }),
          catchError(err => {
            this.loading = false;
            return throwError(() => err);
          })
        );
  }

  onClickSauce(id: string) {
    this.router.navigate(['sauce', id]);
  }

}
