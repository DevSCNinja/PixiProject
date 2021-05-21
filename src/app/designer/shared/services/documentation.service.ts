import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface DocSection {
    header: string;
    text: string;
}

@Injectable({
    providedIn: 'root'
})
export class DocumentationService {
    constructor(private http: HttpClient) {}

    getHelpSections(): Promise<DocSection[]> {
        const headers = new HttpHeaders({
            'Cache-Control': 'no-cache, no-store, must-revalidate, post-check=0, pre-check=0',
            Pragma: 'no-cache',
            Expires: '0'
        });

        return this.http
            .get('./monuvision-assets/test/help.json', { headers })
            .toPromise()
            .then((response) => response as DocSection[])
            .catch(this.handleError);
    }

    private handleError(error: any): Promise<any> {
        console.warn('An error occurred', error);
        return Promise.reject(error.message || error);
    }
}
