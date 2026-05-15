import { useEffect, useRef, useState } from 'react';
import {
  BrowserMultiFormatReader, NotFoundException,
  DecodeHintType, BarcodeFormat,
} from '@zxing/library';
import { X, RefreshCw, ScanLine, CameraOff } from 'lucide-react';

interface Props {
  open:     boolean;
  onClose:  () => void;
  onResult: (value: string) => void;
  title?:   string;
}

export function BarcodeScanner({ open, onClose, onResult, title = 'ສະແກນ Barcode' }: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const readerRef    = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const onResultRef  = useRef(onResult);
  const onCloseRef   = useRef(onClose);
  const [error,      setError]     = useState('');
  const [scanning,   setScanning]  = useState(false);
  const [facingBack, setFacingBack] = useState(true);
  const [hasMulti,   setHasMulti]  = useState(false);

  // ອັບເດດ ref ທຸກ render ໃຫ້ callback ໃນ closure ບໍ່ stale
  onResultRef.current = onResult;
  onCloseRef.current  = onClose;

  const stopAll = () => {
    readerRef.current?.reset();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startCamera = async (back: boolean) => {
    stopAll();
    setError('');
    setScanning(false);

    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: back ? 'environment' : 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // ກວດຈຳນວນກ້ອງ (ສຳລັບປຸ່ມສະລັບ)
      const devices = await navigator.mediaDevices.enumerateDevices();
      setHasMulti(devices.filter((d) => d.kind === 'videoinput').length > 1);

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      // ເລີ່ມ decode — ເປີດທຸກ format + TRY_HARDER
      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.EAN_13,   BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,    BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,  BarcodeFormat.CODABAR,
        BarcodeFormat.ITF,      BarcodeFormat.PDF_417,
        BarcodeFormat.DATA_MATRIX, BarcodeFormat.AZTEC,
        BarcodeFormat.RSS_14,   BarcodeFormat.RSS_EXPANDED,
      ]);
      const reader = new BrowserMultiFormatReader(hints as Map<DecodeHintType, boolean>);
      readerRef.current = reader;
      setScanning(true);

      reader.decodeFromStream(stream, videoRef.current, (result, err) => {
        if (result) {
          const val = result.getText();
          stopAll();
          onResultRef.current(val);
          onCloseRef.current();
        }
        if (err && !(err instanceof NotFoundException)) {
          // IgnoreNotFoundException — fires every frame when no barcode visible
        }
      });
    } catch (e: unknown) {
      const msg = (e as { name?: string })?.name;
      if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
        setError('ກະລຸນາອະນຸຍາດ Camera Permission ໃນ browser ກ່ອນ');
      } else if (msg === 'NotFoundError') {
        setError('ບໍ່ພົບກ້ອງໃນອຸປະກອນນີ້');
      } else {
        setError('ບໍ່ສາມາດເປີດກ້ອງໄດ້ — ລອງ refresh ໜ້າໃໝ່');
      }
      setScanning(false);
    }
  };

  // facingBack ຈົງໃຈຂາດ dep — ພຽງ restart ຕອນ open ປ່ຽນ
  // (ການ switch ກ້ອງໃຊ້ handleSwitch ໂດຍກົງ)
  useEffect(() => {
    if (open) {
      startCamera(facingBack);
    } else {
      stopAll();
      setError('');
    }
    return () => { stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSwitch = () => {
    const next = !facingBack;
    setFacingBack(next);
    startCamera(next);
  };

  const handleClose = () => { stopAll(); setError(''); onClose(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black aspect-[4/3] w-full">
          <video
            ref={videoRef}
            muted playsInline
            className="w-full h-full object-cover"
          />

          {/* Scan guide overlay */}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-28 border-2 border-green-400 rounded-lg">
                {[
                  'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl',
                  'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr',
                  'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl',
                  'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-5 h-5 border-green-400 ${cls}`} />
                ))}
                <div
                  className="absolute left-0 right-0 h-0.5 bg-green-400/90"
                  style={{ animation: 'scan 2s ease-in-out infinite' }}
                />
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
              <CameraOff className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-white text-sm">{error}</p>
            </div>
          )}

          {/* Status */}
          {!error && (
            <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
              <span className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
                {scanning ? '🔍 ວາງ Barcode ໃນກ່ອງ' : '⏳ ກຳລັງຕຽມກ້ອງ...'}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          {hasMulti ? (
            <button
              onClick={handleSwitch}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {facingBack ? 'ສະລັບກ້ອງໜ້າ' : 'ສະລັບກ້ອງຫຼັງ'}
            </button>
          ) : <div />}
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            ປິດ
          </button>
        </div>
      </div>
    </div>
  );
}
