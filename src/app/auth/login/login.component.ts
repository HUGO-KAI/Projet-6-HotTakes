import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SaucesService } from '../../services/sauces.service';
import { Router } from '@angular/router';
import { Sauce } from '../../models/Sauce.model';
import { Observable, throwError } from 'rxjs';
import { catchError, EMPTY, tap } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  isFocused!:boolean;
  showPassword!: boolean;
  loginForm!: FormGroup;
  loading!: boolean;
  errorMsg!: string;
  sauces: Sauce[] = [];
  sauces$!: Observable<Sauce[]>;

  constructor(private formBuilder: FormBuilder,
              private auth: AuthService,
              private SaucesService: SaucesService,
              private router: Router) { }

  ngOnInit() {
    this.loading = true;
    this.loginForm = this.formBuilder.group({
      email: [null, [Validators.required, Validators.email]],
      password: [null, Validators.required]
    });
    
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

  onLogin() {
    this.loading = true;
    this.showPassword = false;
    this.isFocused = false;
    const email = this.loginForm.get('email')!.value;
    const password = this.loginForm.get('password')!.value;
    this.auth.loginUser(email, password).pipe(
      tap(() => {
        this.loading = false;
        this.router.navigate(['/sauces']);
      }),
      catchError(res => {
        this.loading = false;
        this.errorMsg = res.error.message;
        return EMPTY;
      })
    ).subscribe();
  }

  guestLogin() {
    this.loading = true;
    const email = "user1@gmail.com";
    const password = "User123456";
    this.auth.loginUser(email, password).pipe(
      tap(() => {
        this.loading = false;
        this.router.navigate(['/sauces']);
      }),
      catchError(res => {
        this.loading = false;
        this.errorMsg = res.error.message;
        return EMPTY;
      })
    ).subscribe();
  }

  onTogglePassword() {
    this.showPassword = !this.showPassword;
  }
  onClickSauce(id: string) {
    this.router.navigate(['sauce', id]);
  }
  getType(value: any): string {
  return typeof value;
}
}
