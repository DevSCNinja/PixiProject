import { TestBed } from '@angular/core/testing';

import { SceneService } from './scene.service';

describe('SceneService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SceneService = TestBed.get(SceneService);
    expect(service).toBeTruthy();
  });
});
