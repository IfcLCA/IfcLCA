import { MaterialService } from '../material-service';
import { KBOBMaterial } from '@/models/kbob';

jest.mock('@/models/kbob');

const mockedModel = KBOBMaterial as jest.Mocked<typeof KBOBMaterial>;

describe('findBestKBOBMatch', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns exact match', async () => {
    mockedModel.findOne.mockReturnValueOnce({
      lean: () => Promise.resolve({ Name: 'Concrete' })
    } as any);
    const res = await MaterialService.findBestKBOBMatch('Concrete');
    expect(res).toEqual({ kbobMaterial: { Name: 'Concrete' }, score: 1.0 });
    expect(mockedModel.findOne).toHaveBeenCalledWith({ Name: 'Concrete' });
  });

  it('returns case-insensitive match for Ökobaudat', async () => {
    mockedModel.findOne
      .mockReturnValueOnce({ lean: () => Promise.resolve(null) } as any)
      .mockReturnValueOnce({
        lean: () => Promise.resolve({ Name: 'Brick' })
      } as any);
    const res = await MaterialService.findBestKBOBMatch('BRICK');
    expect(res).toEqual({ kbobMaterial: { Name: 'Brick' }, score: 0.99 });
    expect(mockedModel.findOne).toHaveBeenNthCalledWith(1, { Name: 'BRICK' });
  });
});
