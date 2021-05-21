import { TestBed } from '@angular/core/testing';

import { MeasurementService } from './measurement.service';

describe('MeasurementService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: MeasurementService = TestBed.get(MeasurementService);
    expect(service).toBeTruthy();
  });
});
