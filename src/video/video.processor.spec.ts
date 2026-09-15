jest.mock('node:child_process', () => ({
  execFile: jest.fn((...args: unknown[]) => {
    const callback = args.at(-1) as (error: Error | null, stdout: string, stderr: string) => void
    callback(null, '', '')
  }),
}))

import { VideoProcessor } from './video.processor'

describe('VideoProcessor', () => {
  const video_model = { findById: jest.fn() }
  const storage_service = {
    download_to_file: jest.fn(),
    upload_file: jest.fn(),
    public_url: jest.fn((key: string) => `https://cdn.test/${key}`),
  }
  const video_service = { mark_ready: jest.fn(), mark_failed: jest.fn() }
  let processor: VideoProcessor

  beforeEach(() => {
    jest.clearAllMocks()
    storage_service.public_url.mockImplementation((key: string) => `https://cdn.test/${key}`)
    processor = new VideoProcessor(video_model as any, storage_service as any, video_service as any)
  })

  it('marks a successfully transcoded video ready with its HLS and thumbnail URLs', async () => {
    video_model.findById.mockResolvedValue({ id: 'video-1', source_key: 'uploads/source.mp4' })
    jest.spyOn(processor as any, 'upload_directory').mockResolvedValue(undefined)

    await processor.transcode({ data: { video_id: 'video-1' } } as any)

    expect(storage_service.download_to_file).toHaveBeenCalledWith(
      'uploads/source.mp4',
      '/tmp/videostream/video-1/source.mp4',
    )
    expect(video_service.mark_ready).toHaveBeenCalledWith(
      'video-1',
      'https://cdn.test/videos/video-1/master.m3u8',
      'https://cdn.test/videos/video-1/thumbnail.jpg',
    )
    expect(video_service.mark_failed).not.toHaveBeenCalled()
  })

  it('marks a video failed and rethrows when storage or ffmpeg fails', async () => {
    video_model.findById.mockResolvedValue({ id: 'video-1', source_key: 'uploads/source.mp4' })
    storage_service.download_to_file.mockRejectedValue(new Error('object missing'))

    await expect(processor.transcode({ data: { video_id: 'video-1' } } as any)).rejects.toThrow('object missing')

    expect(video_service.mark_failed).toHaveBeenCalledWith('video-1')
    expect(video_service.mark_ready).not.toHaveBeenCalled()
  })

  it('fails fast when a queued video has been deleted', async () => {
    video_model.findById.mockResolvedValue(null)

    await expect(processor.transcode({ data: { video_id: 'gone' } } as any)).rejects.toThrow('Video not found: gone')

    expect(video_service.mark_failed).not.toHaveBeenCalled()
  })
})
