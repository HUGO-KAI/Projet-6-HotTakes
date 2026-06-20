import { Injectable } from '@angular/core';
import { catchError,map, mapTo, of, Subject, tap, throwError, Observable } from 'rxjs';
import { Sauce } from '../models/Sauce.model';
import { HttpClient,HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

// 1. 定义后端返回的新数据结构接口
interface SaucesResponse {
  data: Sauce[];
  nextKey: string | null;
}
@Injectable({
  providedIn: 'root'
})
export class SaucesService {
  sauces$ = new Subject<Sauce[]>();
  private baseUrl = environment.apiUrl;
  // 1. 新增一个内存变量，用来缓存已经累计加载的所有 sauces
  private allLoadedSauces: Sauce[] = [];
  // 2. 新增一个属性，用来在内存中记录下一页的“钥匙”
  private currentNextKey: string | null = null;

  constructor(private http: HttpClient,
              private auth: AuthService) {}
  //get all sauces with pagination
  getAllSauces(isLoadMore: boolean = false): Observable<Sauce[]> {
    if (!isLoadMore) {
      this.currentNextKey = null;
      this.allLoadedSauces = [];
    }

    let params = new HttpParams();
    if (isLoadMore && this.currentNextKey) {
      params = params.set('nextKey', this.currentNextKey);
    }

    return this.http.get<SaucesResponse>(this.baseUrl + '/sauces', { params }).pipe(
      tap(res => {
        this.currentNextKey = res.nextKey;
        if (!isLoadMore) {
          this.allLoadedSauces = res.data;
        } else {
          this.allLoadedSauces = [...this.allLoadedSauces, ...res.data];
        }
        this.sauces$.next(this.allLoadedSauces);
      }),
      map(() => this.allLoadedSauces),
      catchError(error => {
        console.error(error);
        return of<Sauce[]>([]); // return empty array on error to keep the stream alive
      })
    );
  }
  //get one user's sauces
  getUserSauces() {
    this.http.get<SaucesResponse>(this.baseUrl+'/sauces/getUserSauces').pipe(
      tap(sauces => this.sauces$.next(sauces.data)),
      catchError(error => {
        console.error(error.error.message);
        return of([]);
      })
    ).subscribe();
  }
  //get one sauce with sauce id
  getSauceById(id: string) {
    return this.http.get<Sauce>(this.baseUrl+'/sauces/' + id).pipe(
      catchError(error => throwError(error.error.message))
    );
  }

  likeSauce(id: string, like: boolean) {
    return this.http.post<{ message: string }>(
      this.baseUrl+'/sauces/' + id + '/like',
      { userId: this.auth.getUserId(), like: like ? 1 : 0 }
    ).pipe(
      mapTo(like),
      catchError(error => throwError(error.error.message))
    );
  }

  dislikeSauce(id: string, dislike: boolean) {
    return this.http.post<{ message: string }>(
      this.baseUrl+'/sauces/' + id + '/like',
      { userId: this.auth.getUserId(), like: dislike ? -1 : 0 }
    ).pipe(
      mapTo(dislike),
      catchError(error => throwError(error.error.message))
    );
  }

  createSauce(sauce: Sauce, image: File) {
    const formData = new FormData();
    formData.append('sauce', JSON.stringify(sauce));
    formData.append('image', image);
    return this.http.post<{ message: string }>(this.baseUrl+'/sauces', formData).pipe(
      catchError(error => throwError(error.error.message))
    );
  }

  modifySauce(id: string, sauce: Sauce, image: string | File) {
    if (typeof image === 'string') {
      return this.http.put<{ message: string }>(this.baseUrl+'/sauces/' + id, sauce).pipe(
        catchError(error => throwError(error.error.message))
      );
    } else {
      const formData = new FormData();
      formData.append('sauce', JSON.stringify(sauce));
      formData.append('image', image);
      return this.http.put<{ message: string }>(this.baseUrl+'/sauces/' + id, formData).pipe(
        catchError(error => throwError(error.error.message))
      );
    }
  }

  deleteSauce(id: string) {
    return this.http.delete<{ message: string }>(this.baseUrl+'/sauces/' + id).pipe(
      catchError(error => throwError(error.error.message))
    );
  }
}
