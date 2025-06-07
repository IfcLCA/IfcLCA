import { MaterialService } from '../material-service';

describe('calculateIndicators', () => {
  it('calculates indicators for a KBOB material', () => {
    const mat = {
      KBOB_ID: 1,
      Name: 'Concrete',
      GWP: 10,
      UBP: 20,
      PENRE: 5
    } as any;
    const res = MaterialService.calculateIndicators(2, 2400, mat);
    expect(res).toEqual({ gwp: 48000, ubp: 96000, penre: 24000 });
  });

  it('calculates indicators for an Ökobaudat material', () => {
    const mat = {
      Name: 'Brick',
      GWP: 15,
      UBP: 30,
      PENRE: 7,
      'kg/unit': 1800
    } as any;
    const res = MaterialService.calculateIndicators(1.5, 1800, mat);
    expect(res).toEqual({ gwp: 40500, ubp: 81000, penre: 18900 });
  });
});
