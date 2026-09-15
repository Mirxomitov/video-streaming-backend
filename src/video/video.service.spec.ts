import { VideoService } from './video.service'
import { VideoStatus } from './enums/video-status.enum'

describe('VideoService', () => {
  const storage_service = {
    create_upload_url: jest.fn(),
    public_url: jest.fn(),
  }
  const transcode_queue = { add: jest.fn() }
  const video_model = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }
  let service: VideoService

  beforeEach(() => {
    jest.resetAllMocks()
    service = new VideoService(video_model as any, transcode_queue as any, storage_service as any)
  })

  it('creates a storage key owned by the uploader and returns its signed URL', async () => {
    storage_service.create_upload_url.mockResolvedValue('https://storage.test/signed-upload')
    video_model.create.mockResolvedValue({ id: 'video-1' })

    await expect(service.create_upload('user-1', 'My video', 'Description')).resolves.toEqual({
      video_id: 'video-1',
      upload_url: 'https://storage.test/signed-upload',
    })

    expect(video_model.create).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'user-1',
      title: 'My video',
      description: 'Description',
      source_key: expect.stringMatching(/^uploads\/user-1\/.+\.mp4$/),
    }))
    expect(storage_service.create_upload_url).toHaveBeenCalledWith(
      expect.stringMatching(/^uploads\/user-1\/.+\.mp4$/),
      'video/mp4',
    )
  })

  it('moves an owned upload to processing and queues exactly one transcode job', async () => {
    const video = { id: 'video-1', status: VideoStatus.UPLOADING, save: jest.fn() }
    video_model.findOne.mockResolvedValue(video)

    await expect(service.complete_upload('video-1', 'user-1')).resolves.toBe(video)

    expect(video.status).toBe(VideoStatus.PROCESSING)
    expect(video.save).toHaveBeenCalledTimes(1)
    expect(transcode_queue.add).toHaveBeenCalledWith(
      { video_id: 'video-1' },
      { jobId: 'video-1', removeOnComplete: true, removeOnFail: 100 },
    )
  })

  it('does not queue an already processing video again', async () => {
    const video = { id: 'video-1', status: VideoStatus.PROCESSING, save: jest.fn() }
    video_model.findOne.mockResolvedValue(video)

    await expect(service.complete_upload('video-1', 'user-1')).resolves.toBe(video)

    expect(video.save).not.toHaveBeenCalled()
    expect(transcode_queue.add).not.toHaveBeenCalled()
  })

  it('returns a cursor page and applies safe search/category/tag filters', async () => {
    const first = { id: 'video-1', created_at: new Date('2026-01-02T00:00:00.000Z') }
    const second = { id: 'video-2', created_at: new Date('2026-01-01T00:00:00.000Z') }
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([first, second]),
    }
    video_model.find.mockReturnValue(query)

    const result = await service.find_ready(1, undefined, {
      category: 'education',
      tag: 'nestjs',
      q: 'a.*',
    })

    expect(result).toEqual({
      items: [first],
      next_cursor: Buffer.from(JSON.stringify({ created_at: first.created_at.toISOString(), id: first.id })).toString('base64url'),
    })
    expect(video_model.find).toHaveBeenCalledWith(expect.objectContaining({
      status: VideoStatus.READY,
      category: 'education',
      tags: 'nestjs',
      $or: expect.arrayContaining([expect.objectContaining({ title: { $regex: 'a\\.\\*', $options: 'i' } })]),
    }))
    expect(query.limit).toHaveBeenCalledWith(2)
  })
})
