import { TestBed } from '@angular/core/testing';

import { AssetService } from './asset.service';

describe('AssetService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: AssetService = TestBed.get(AssetService);
    expect(service).toBeTruthy();
  });
});
