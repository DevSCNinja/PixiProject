import { TestBed } from '@angular/core/testing';

import { DesignService } from './design.service';

describe('DesignService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: DesignService = TestBed.get(DesignService);
    expect(service).toBeTruthy();
  });
});
