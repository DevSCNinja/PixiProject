import { TestBed } from '@angular/core/testing';

import { BackgroundService } from './background.service';

describe('BackgroundServiceService', () => {
    beforeEach(() => TestBed.configureTestingModule({}));

    it('should be created', () => {
        const service: BackgroundService = TestBed.get(BackgroundService);
        expect(service).toBeTruthy();
    });
});
