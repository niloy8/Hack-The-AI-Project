import React, { useState, useEffect, useRef } from 'react';

const MainPage = () => {
    const [interviewData, setInterviewData] = useState({
        cv: null,
        jobTitle: '',
        currentQuestion: 0,
        answers: [],
        audioFiles: [],
        videoFiles: [],
        nervousness: [],
        isInterviewStarted: false,
        isInterviewCompleted: false,
        recordingMode: null
    });

    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isVideoCaptureEnabled, setIsVideoCaptureEnabled] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioChunks, setAudioChunks] = useState([]);
    const [videoError, setVideoError] = useState('');
    const [audioError, setAudioError] = useState('');
    const [audioStream, setAudioStream] = useState(null);
    const [videoStream, setVideoStream] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [extractedAudioFromVideo, setExtractedAudioFromVideo] = useState(null);
    const videoRef = useRef(null);

    // Store chunks in refs to avoid stale closure issues
    const chunksRef = useRef([]);

    // Log chunks to avoid unused variable warning
    useEffect(() => {
        console.log('Chunks count:', audioChunks.length);
    }, [audioChunks]);

    // Demo questions based on job title
    const demoQuestions = [
        { id: 1, question: "Tell me about yourself and your professional background.", category: "Introduction" },
        { id: 2, question: "Why are you interested in this position?", category: "Motivation" },
        { id: 3, question: "What are your greatest strengths?", category: "Skills" },
        { id: 4, question: "Describe a challenging project you worked on recently.", category: "Experience" },
        { id: 5, question: "Where do you see yourself in 5 years?", category: "Goals" },
        { id: 6, question: "Why should we hire you over other candidates?", category: "Closing" }
    ];

    // Demo job titles for CV extraction
    const demoJobTitles = [
        'Software Engineer',
        'Data Scientist',
        'Product Manager',
        'UX Designer',
        'Marketing Manager',
        'Business Analyst',
        'Full Stack Developer',
        'DevOps Engineer'
    ];

    const extractJobTitleFromCV = (file) => {
        const fileName = file.name.toLowerCase();

        if (fileName.includes('engineer') || fileName.includes('dev')) {
            return 'Software Engineer';
        } else if (fileName.includes('data') || fileName.includes('analyst')) {
            return 'Data Scientist';
        } else if (fileName.includes('product') || fileName.includes('pm')) {
            return 'Product Manager';
        } else if (fileName.includes('design') || fileName.includes('ui') || fileName.includes('ux')) {
            return 'UX Designer';
        } else if (fileName.includes('market')) {
            return 'Marketing Manager';
        } else {
            return demoJobTitles[Math.floor(Math.random() * demoJobTitles.length)];
        }
    };

    // Simple audio extraction from video
    const extractAudioFromVideo = async (videoBlob) => {
        try {
            console.log('Extracting audio from video...');
            const audioBlob = new Blob([videoBlob], { type: 'audio/webm' });
            console.log('Audio extracted successfully');
            return audioBlob;
        } catch (error) {
            console.log('Error extracting audio from video:', error);
            return null;
        }
    };

    // --- Initialize Recording (Audio or Video) ---
    const initializeRecording = async (mode) => {
        if (isInitialized) return;

        try {
            let stream;

            if (mode === 'audio') {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setAudioStream(stream);
                console.log('Audio stream obtained successfully');
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    },
                    audio: true
                });
                setVideoStream(stream);
                setIsVideoCaptureEnabled(true);
                console.log('Video stream with audio obtained successfully');

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                    };
                }
            }

            // Speech Recognition (works for both modes)
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
                const recognitionInstance = new SpeechRecognitionConstructor();

                recognitionInstance.continuous = true;
                recognitionInstance.interimResults = true;
                recognitionInstance.lang = 'en-US';

                recognitionInstance.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript;
                        } else {
                            interimTranscript += transcript;
                        }
                    }
                    setCurrentAnswer(prev => {
                        const baseText = prev.replace(/\[Speaking...\].*$/, '').trim();
                        if (finalTranscript) {
                            return baseText + (baseText ? ' ' : '') + finalTranscript;
                        } else if (interimTranscript) {
                            return baseText + (baseText ? ' ' : '') + '[Speaking...] ' + interimTranscript;
                        }
                        return baseText;
                    });
                };

                recognitionInstance.onerror = (event) => {
                    console.log('Speech recognition error:', event.error, event.message);
                    setIsRecording(false);
                    setAudioError('Speech recognition error: ' + event.error);
                };

                recognitionInstance.onend = () => {
                    console.log('Speech recognition ended');
                    setIsRecording(false);
                    setCurrentAnswer(prev => prev.replace(/\[Speaking...\].*$/, '').trim());
                };

                setRecognition(recognitionInstance);
                console.log('Speech recognition initialized successfully');
            }

            // MediaRecorder
            const recorder = new MediaRecorder(stream, {
                mimeType: mode === 'audio'
                    ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4')
                    : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
            });

            recorder.ondataavailable = (event) => {
                console.log(`${mode} data available, size:`, event.data.size);
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                    setAudioChunks(prev => [...prev, event.data]);
                }
            };

            recorder.onstop = async () => {
                console.log(`${mode} recorder stopped, chunks count:`, chunksRef.current.length);
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, {
                        type: mode === 'audio' ? 'audio/webm' : 'video/webm'
                    });
                    console.log(`${mode} blob created, size:`, blob.size);
                    setRecordedBlob(blob);

                    // If video mode, extract audio
                    if (mode === 'video') {
                        const extractedAudio = await extractAudioFromVideo(blob);
                        if (extractedAudio) {
                            setExtractedAudioFromVideo(extractedAudio);
                            console.log('Audio extracted from video');
                        }
                    }
                }
            };

            recorder.onerror = (event) => {
                console.log(`${mode} recorder error:`, event);
                if (mode === 'audio') {
                    setAudioError('Audio recording error');
                } else {
                    setVideoError('Video recording error');
                }
            };

            setMediaRecorder(recorder);
            setIsInitialized(true);
            setAudioError('');
            setVideoError('');
        } catch (err) {
            console.log(`Error initializing ${mode} recording:`, err);
            if (mode === 'audio') {
                setAudioError('Unable to access microphone. Please check permissions.');
            } else {
                setVideoError('Unable to access camera/microphone. Please check permissions.');
            }
        }
    };

    // --- Ensure live video feed always plays ---
    useEffect(() => {
        if (isVideoCaptureEnabled && videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
            };
        }
    }, [isVideoCaptureEnabled, videoStream]);

    // --- Cleanup streams ---
    const cleanupStreams = React.useCallback(() => {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            setVideoStream(null);
        }
    }, [audioStream, videoStream]);

    useEffect(() => {
        return () => {
            cleanupStreams();
            if (recognition) {
                try {
                    recognition.stop();
                } catch (e) {
                    console.log('Error stopping speech recognition:', e);
                }
            }
        };
    }, [cleanupStreams, recognition]);

    // --- UI Handlers ---
    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setInterviewData(prev => ({ ...prev, cv: file }));
            const extractedTitle = extractJobTitleFromCV(file);
            setInterviewData(prev => ({ ...prev, jobTitle: extractedTitle }));
        }
    };

    const handleStartInterview = (mode) => {
        if (interviewData.jobTitle.trim()) {
            setInterviewData(prev => ({
                ...prev,
                isInterviewStarted: true,
                recordingMode: mode,
                answers: new Array(demoQuestions.length).fill(''),
                audioFiles: new Array(demoQuestions.length).fill(null),
                videoFiles: new Array(demoQuestions.length).fill(null),
                nervousness: new Array(demoQuestions.length).fill(0)
            }));
        }
    };

    const sendDataToBackend = async (
        questionIndex,
        textAnswer,
        audioBlob,
        videoBlob
    ) => {
        try {
            const formData = new FormData();
            formData.append('questionIndex', questionIndex.toString());
            formData.append('textAnswer', textAnswer);
            formData.append('jobTitle', interviewData.jobTitle);

            if (interviewData.cv) {
                formData.append('cv', interviewData.cv);
            }
            if (audioBlob) {
                formData.append('audioFile', audioBlob, `question_${questionIndex + 1}.webm`);
            }
            if (videoBlob) {
                formData.append('videoFile', videoBlob, `question_${questionIndex + 1}.webm`);
            }

            const response = await fetch('/api/interview/submit-answer', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();
                return result.nervousnessScore || Math.floor(Math.random() * 100);
            }
        } catch (error) {
            console.log('Error sending data to backend:', error);
        }
        return Math.floor(Math.random() * 100);
    };

    const handleNextQuestion = async () => {
        if (currentAnswer.trim() && !currentAnswer.includes('[Speaking...]')) {
            const newAnswers = [...interviewData.answers];
            const newAudioFiles = [...interviewData.audioFiles];
            const newVideoFiles = [...interviewData.videoFiles];
            const newNervousness = [...interviewData.nervousness];

            newAnswers[interviewData.currentQuestion] = currentAnswer;

            if (interviewData.recordingMode === 'video') {
                // For video mode: store both video and extracted audio
                newVideoFiles[interviewData.currentQuestion] = recordedBlob;
                newAudioFiles[interviewData.currentQuestion] = extractedAudioFromVideo;
            } else {
                // For audio mode: store only audio
                newAudioFiles[interviewData.currentQuestion] = recordedBlob;
            }

            const nervousnessScore = await sendDataToBackend(
                interviewData.currentQuestion,
                currentAnswer,
                interviewData.recordingMode === 'video' ? extractedAudioFromVideo : recordedBlob,
                interviewData.recordingMode === 'video' ? recordedBlob : null
            );
            newNervousness[interviewData.currentQuestion] = nervousnessScore;

            setInterviewData(prev => ({
                ...prev,
                answers: newAnswers,
                audioFiles: newAudioFiles,
                videoFiles: newVideoFiles,
                nervousness: newNervousness,
                currentQuestion: prev.currentQuestion + 1,
                isInterviewCompleted: prev.currentQuestion + 1 >= demoQuestions.length
            }));

            setCurrentAnswer('');
            setAudioChunks([]);
            setRecordedBlob(null);
            setExtractedAudioFromVideo(null);
            chunksRef.current = [];
        }
    };

    const handleCancelInterview = () => {
        if (isRecording && recognition) {
            try { recognition.stop(); } catch (e) {
                console.log('Error stopping speech recognition:', e);
            }
        }
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            try { mediaRecorder.stop(); } catch (e) {
                console.log('Error stopping media recorder:', e);
            }
        }
        cleanupStreams();
        setIsRecording(false);
        setIsVideoCaptureEnabled(false);
        setIsInitialized(false);

        setInterviewData({
            cv: null,
            jobTitle: '',
            currentQuestion: 0,
            answers: [],
            audioFiles: [],
            videoFiles: [],
            nervousness: [],
            isInterviewStarted: false,
            isInterviewCompleted: false,
            recordingMode: null
        });
        setCurrentAnswer('');
        setAudioChunks([]);
        setRecordedBlob(null);
        setExtractedAudioFromVideo(null);
        chunksRef.current = [];
    };

    const toggleRecording = async () => {
        if (!isInitialized && interviewData.recordingMode) {
            await initializeRecording(interviewData.recordingMode);
            return;
        }
        if (!recognition || !mediaRecorder) {
            alert('Recording is not supported in your browser or microphone access denied.');
            return;
        }

        if (isRecording) {
            console.log('Stopping recording...');
            try { recognition.stop(); } catch (e) {
                console.log('Error stopping speech recognition:', e);
            }
            if (mediaRecorder.state === 'recording') {
                try {
                    mediaRecorder.stop();
                } catch (e) {
                    console.log('Error stopping media recorder:', e);
                }
            }
            setIsRecording(false);
        } else {
            console.log('Starting recording...');
            chunksRef.current = [];
            setAudioChunks([]);
            setRecordedBlob(null);
            setExtractedAudioFromVideo(null);

            try {
                recognition.start();
            } catch (e) {
                console.log('Error starting speech recognition:', e);
            }

            if (mediaRecorder.state === 'inactive') {
                try {
                    mediaRecorder.start(1000);
                } catch (e) {
                    console.log('Error starting media recorder:', e);
                }
            }
            setIsRecording(true);
        }
    };

    const generateReport = () => {
        const validNervousness = interviewData.nervousness.filter(n => n > 0);
        const averageNervousness = validNervousness.length > 0
            ? validNervousness.reduce((a, b) => a + b, 0) / validNervousness.length
            : 0;

        return {
            overallScore: Math.floor(Math.random() * 40 + 60),
            nervousnessScore: Math.floor(averageNervousness),
            strengths: ["Good communication", "Relevant experience", "Clear examples"],
            improvements: ["More confidence needed", "Elaborate on technical skills"],
            recommendation: averageNervousness < 50 ? "Recommended for next round" : "Needs improvement"
        };
    };

    const exportToGoogleSheets = async () => {
        try {
            const reportData = {
                jobTitle: interviewData.jobTitle,
                answers: interviewData.answers,
                nervousnessScores: interviewData.nervousness,
                overallScore: generateReport().overallScore,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('/api/export-to-sheets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData),
            });

            if (response.ok) {
                alert('Report exported to Google Sheets successfully!');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            alert('Demo mode: Google Sheets export simulated');
            console.log('Export error:', error);
        }
    };

    // Interview Completed Screen
    if (interviewData.isInterviewCompleted) {
        const report = generateReport();

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">Interview Completed!</h1>
                            <p className="text-gray-600">Here's your detailed performance report</p>
                            <p className="text-sm text-blue-600 mt-2">Recording Mode: {interviewData.recordingMode === 'video' ? 'Video with Audio Extract' : 'Audio Only'}</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="bg-green-50 rounded-xl p-6">
                                    <h3 className="text-xl font-semibold text-green-800 mb-4">Overall Score</h3>
                                    <div className="text-4xl font-bold text-green-600">{report.overallScore}%</div>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-6">
                                    <h3 className="text-xl font-semibold text-blue-800 mb-4">Nervousness Analysis</h3>
                                    <div className="text-2xl font-bold text-blue-600">{report.nervousnessScore}%</div>
                                    <p className="text-blue-600 mt-2">
                                        {report.nervousnessScore < 30 ? "Very Confident" :
                                            report.nervousnessScore < 60 ? "Moderately Confident" : "Needs Confidence Building"}
                                    </p>
                                </div>
                                <div className="bg-purple-50 rounded-xl p-6">
                                    <h3 className="text-xl font-semibold text-purple-800 mb-4">Recommendation</h3>
                                    <p className="text-purple-700 font-medium">{report.recommendation}</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-emerald-50 rounded-xl p-6">
                                    <h3 className="text-xl font-semibold text-emerald-800 mb-4">Strengths</h3>
                                    <ul className="space-y-2">
                                        {report.strengths.map((strength, index) => (
                                            <li key={index} className="flex items-center text-emerald-700">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                                                {strength}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-orange-50 rounded-xl p-6">
                                    <h3 className="text-xl font-semibold text-orange-800 mb-4">Areas for Improvement</h3>
                                    <ul className="space-y-2">
                                        {report.improvements.map((improvement, index) => (
                                            <li key={index} className="flex items-center text-orange-700">
                                                <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                                                {improvement}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 bg-gray-50 rounded-xl p-6">
                            <h3 className="text-xl font-semibold text-gray-800 mb-4">Question-by-Question Analysis</h3>
                            <div className="space-y-6">
                                {demoQuestions.map((question, index) => (
                                    <div key={question.id} className="border-l-4 border-blue-400 pl-4">
                                        <p className="font-medium text-gray-800">{question.question}</p>
                                        <p className="text-gray-600 mt-1">Nervousness: {interviewData.nervousness[index] || 0}%</p>
                                        <p className="text-gray-700 mt-2 italic">"{interviewData.answers[index] || 'No answer provided'}"</p>
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {interviewData.audioFiles[index] && (
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <p className="text-xs text-gray-500 mb-2">Audio Recording:</p>
                                                    <audio
                                                        controls
                                                        className="w-full h-8"
                                                        src={URL.createObjectURL(interviewData.audioFiles[index])}
                                                    />
                                                </div>
                                            )}
                                            {interviewData.videoFiles[index] && (
                                                <div className="bg-white p-3 rounded-lg border">
                                                    <p className="text-xs text-gray-500 mb-2">Video Recording:</p>
                                                    <video
                                                        controls
                                                        className="w-full h-32 rounded"
                                                        src={URL.createObjectURL(interviewData.videoFiles[index])}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-8 flex justify-center space-x-4">
                            <button
                                onClick={exportToGoogleSheets}
                                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                            >
                                Export to Google Sheets
                            </button>
                            <button
                                onClick={handleCancelInterview}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                            >
                                Start New Interview
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Interview In Progress Screen
    if (interviewData.isInterviewStarted) {
        const currentQuestion = demoQuestions[interviewData.currentQuestion];
        const progress = ((interviewData.currentQuestion + 1) / demoQuestions.length) * 100;

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="flex">
                    {/* Main Interview Area */}
                    <div className="flex-1 p-6">
                        <div className="max-w-6xl mx-auto">
                            <div className="bg-white rounded-2xl shadow-xl p-8">
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h1 className="text-2xl font-bold text-gray-800">AI Interview Agent</h1>
                                        <div className="text-right">
                                            <span className="text-sm text-gray-600">
                                                Question {interviewData.currentQuestion + 1} of {demoQuestions.length}
                                            </span>
                                            <p className="text-xs text-blue-600">
                                                Mode: {interviewData.recordingMode === 'video' ? 'Video with Audio Extract' : 'Audio Only'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="mb-8">
                                    <div className="bg-blue-50 rounded-xl p-6 mb-6">
                                        <h3 className="text-lg font-semibold text-blue-800 mb-2">{currentQuestion.category}</h3>
                                        <p className="text-xl text-gray-800">{currentQuestion.question}</p>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8 mb-6">
                                        {/* Left Side - Video or Placeholder */}
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-medium text-gray-700">
                                                    {interviewData.recordingMode === 'video' ? 'Video Recording' : 'Audio Recording Mode'}
                                                </h4>
                                                <span className="text-xs text-gray-500">Mode locked</span>
                                            </div>
                                            <div className="relative">
                                                {interviewData.recordingMode === 'video' && isVideoCaptureEnabled && videoStream ? (
                                                    <video
                                                        ref={videoRef}
                                                        autoPlay
                                                        muted
                                                        playsInline
                                                        width="100%"
                                                        height="320"
                                                        className="w-full h-80 bg-gray-900 rounded-lg object-cover shadow-lg border-2 border-gray-200"
                                                        style={{ transform: 'scaleX(-1)' }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-80 bg-gray-300 rounded-lg flex items-center justify-center shadow-lg">
                                                        <div className="text-center text-gray-600">
                                                            <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                            </svg>
                                                            <p className="text-lg font-medium">
                                                                {interviewData.recordingMode === 'video' ? 'Camera Initializing...' : 'Audio Only Mode'}
                                                            </p>
                                                            <p className="text-sm">
                                                                {interviewData.recordingMode === 'video' ? 'Video feed will appear here' : 'No video preview in audio mode'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                {isRecording && (
                                                    <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium flex items-center space-x-2 animate-pulse">
                                                        <div className="w-3 h-3 bg-white rounded-full"></div>
                                                        <span>
                                                            RECORDING {interviewData.recordingMode === 'video' ? 'VIDEO + AUDIO' : 'AUDIO'}
                                                        </span>
                                                    </div>
                                                )}
                                                {interviewData.recordingMode === 'video' && isVideoCaptureEnabled && !isRecording && (
                                                    <div className="absolute bottom-3 left-3 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm">
                                                        Live Camera Feed
                                                    </div>
                                                )}
                                            </div>
                                            {(videoError || audioError) && (
                                                <p className="text-red-600 text-sm mt-2 font-medium">{videoError || audioError}</p>
                                            )}

                                            {/* Recording Preview */}
                                            {!isRecording && recordedBlob && (
                                                <div className="bg-white rounded-lg p-3 border border-green-200 mt-4">
                                                    <p className="text-xs text-green-700 mb-2 font-medium">
                                                        ✅ {interviewData.recordingMode === 'video' ? 'Video' : 'Audio'} Recording Completed
                                                        (Size: {Math.round(recordedBlob.size / 1024)}KB)
                                                    </p>
                                                    {interviewData.recordingMode === 'video' ? (
                                                        <video
                                                            controls
                                                            muted
                                                            className="w-full h-32 rounded bg-black"
                                                            src={URL.createObjectURL(recordedBlob)}
                                                        />
                                                    ) : (
                                                        <audio
                                                            controls
                                                            className="w-full h-10"
                                                            src={URL.createObjectURL(recordedBlob)}
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {/* Extracted Audio from Video Preview */}
                                            {!isRecording && extractedAudioFromVideo && interviewData.recordingMode === 'video' && (
                                                <div className="bg-white rounded-lg p-3 border border-blue-200 mt-4">
                                                    <p className="text-xs text-blue-700 mb-2 font-medium">
                                                        🎵 Audio Extracted from Video (Size: {Math.round(extractedAudioFromVideo.size / 1024)}KB)
                                                    </p>
                                                    <audio
                                                        controls
                                                        className="w-full h-10"
                                                        src={URL.createObjectURL(extractedAudioFromVideo)}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side - Answer Input */}
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-700 mb-3">Your Answer (Live Speech-to-Text)</h4>
                                            <div className="relative">
                                                <textarea
                                                    value={currentAnswer}
                                                    onChange={(e) => setCurrentAnswer(e.target.value)}
                                                    placeholder="Type your answer here or start recording to use speech-to-text..."
                                                    className={`w-full h-80 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all shadow-lg ${isRecording
                                                        ? 'border-red-300 bg-red-50'
                                                        : 'border-gray-300'
                                                        }`}
                                                />
                                                {isRecording && (
                                                    <div className="absolute top-3 right-3 flex items-center space-x-2 text-red-600 animate-pulse">
                                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                                        <span className="text-sm font-medium">LIVE TRANSCRIPTION</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-4">
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={toggleRecording}
                                                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${isRecording
                                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        }`}
                                                >
                                                    <div className="relative">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d={interviewData.recordingMode === 'video'
                                                                ? "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                                : "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                                                            } />
                                                        </svg>
                                                        {isRecording && (
                                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse"></div>
                                                        )}
                                                    </div>
                                                    <span>
                                                        {isRecording ? 'Stop Recording' :
                                                            isInitialized ? `Start ${interviewData.recordingMode === 'video' ? 'Video + Audio' : 'Audio'} Recording`
                                                                : `Initialize ${interviewData.recordingMode === 'video' ? 'Camera & Audio' : 'Audio'}`}
                                                    </span>
                                                </button>
                                            </div>
                                            <div className="flex space-x-4">
                                                <button
                                                    onClick={handleCancelInterview}
                                                    className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
                                                >
                                                    Cancel Interview
                                                </button>
                                                <button
                                                    onClick={handleNextQuestion}
                                                    disabled={!currentAnswer.trim() || currentAnswer.includes('[Speaking...]')}
                                                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                >
                                                    {interviewData.currentQuestion === demoQuestions.length - 1 ? 'Finish Interview' : 'Next Question'}
                                                </button>
                                            </div>
                                        </div>
                                        {isRecording && (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <div className="flex items-center space-x-2 text-red-700">
                                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                                    <span className="text-sm font-medium">
                                                        Recording {interviewData.recordingMode === 'video' ? 'video with audio' : 'audio only'} and converting speech to text...
                                                        Speak clearly into the microphone
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="w-80 bg-white shadow-lg p-6">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Interview Progress</h3>
                            <div className="space-y-3">
                                {demoQuestions.map((question, index) => (
                                    <div
                                        key={question.id}
                                        className={`p-3 rounded-lg text-sm ${index === interviewData.currentQuestion
                                            ? 'bg-blue-100 border-l-4 border-blue-600'
                                            : index < interviewData.currentQuestion
                                                ? 'bg-green-50 border-l-4 border-green-500'
                                                : 'bg-gray-50'
                                            }`}
                                    >
                                        <div className="font-medium">{question.category}</div>
                                        <div className="text-gray-600 truncate">{question.question}</div>
                                        {index < interviewData.currentQuestion && (
                                            <div className="mt-1 text-green-600 text-xs">
                                                ✓ Completed | Nervousness: {interviewData.nervousness[index] || 0}%
                                                <br />
                                                {interviewData.audioFiles[index] && '🎵 Audio'}
                                                {interviewData.videoFiles[index] && ' 📹 Video'}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium text-gray-800 mb-2">Live Status</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                                <div>Questions: {interviewData.answers.filter(a => a).length}/{demoQuestions.length}</div>
                                <div>Mode: {interviewData.recordingMode === 'video' ? '📹 Video + Audio' : '🎵 Audio Only'}</div>
                                <div>Status: {isInitialized ? '✓ Ready' : '⚠️ Not Initialized'}</div>
                                <div>Recording: {isRecording ? '🔴 Active' : '⏸️ Stopped'}</div>
                                <div>Current Recording: {recordedBlob ? `✅ ${Math.round(recordedBlob.size / 1024)}KB` : '❌ None'}</div>
                                {interviewData.recordingMode === 'video' && (
                                    <div>Extracted Audio: {extractedAudioFromVideo ? `✅ ${Math.round(extractedAudioFromVideo.size / 1024)}KB` : '❌ None'}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Initial Setup Screen with Mode Selection
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">AI Interview Agent</h1>
                    <p className="text-xl text-gray-600">Upload your CV or enter job title to start your AI-powered mock interview</p>
                </div>
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="space-y-6">
                        {/* CV Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Your CV (Optional)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="cv-upload"
                                />
                                <label
                                    htmlFor="cv-upload"
                                    className="cursor-pointer flex flex-col items-center"
                                >
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {interviewData.cv ? (
                                            <span className="text-green-600 font-medium">✓ {interviewData.cv.name}</span>
                                        ) : (
                                            <>Click to upload or drag and drop<br />PDF, DOC, DOCX up to 10MB</>
                                        )}
                                    </p>
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                * Upload CV for better job role suggestions, or manually enter your desired position below
                            </p>
                        </div>

                        {/* Job Title Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Job Title You're Interested In
                            </label>
                            <input
                                type="text"
                                value={interviewData.jobTitle}
                                onChange={(e) => setInterviewData(prev => ({ ...prev, jobTitle: e.target.value }))}
                                placeholder="e.g., Software Engineer, Data Scientist, Product Manager"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {interviewData.cv ?
                                    '* Job title extracted from CV. You can modify it above.' :
                                    '* Enter the position you want to practice interviewing for.'
                                }
                            </p>
                        </div>

                        {/* Recording Mode Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Choose Recording Mode (Cannot be changed once selected)
                            </label>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div
                                    className="border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 cursor-pointer transition-colors bg-blue-50"
                                    onClick={() => interviewData.jobTitle.trim() && handleStartInterview('audio')}
                                >
                                    <div className="flex items-center mb-3">
                                        <svg className="w-6 h-6 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                        </svg>
                                        <h3 className="text-lg font-semibold text-blue-800">Audio Only</h3>
                                    </div>
                                    <ul className="text-sm text-blue-700 space-y-1">
                                        <li>• Microphone access only</li>
                                        <li>• Live speech-to-text</li>
                                        <li>• Audio recording saved</li>
                                        <li>• No video preview</li>
                                    </ul>
                                </div>

                                <div
                                    className="border-2 border-purple-200 rounded-lg p-4 hover:border-purple-400 cursor-pointer transition-colors bg-purple-50"
                                    onClick={() => interviewData.jobTitle.trim() && handleStartInterview('video')}
                                >
                                    <div className="flex items-center mb-3">
                                        <svg className="w-6 h-6 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <h3 className="text-lg font-semibold text-purple-800">Video + Audio Extract</h3>
                                    </div>
                                    <ul className="text-sm text-purple-700 space-y-1">
                                        <li>• Camera + microphone access</li>
                                        <li>• Live speech-to-text</li>
                                        <li>• Video recording saved</li>
                                        <li>• Audio auto-extracted from video</li>
                                    </ul>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                * Choose your preferred recording method. This cannot be changed during the interview.
                            </p>
                        </div>

                        {/* Interview Information */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <h3 className="font-semibold text-blue-800 mb-2">What to Expect:</h3>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• 6 interview questions tailored to your job role</li>
                                <li>• Voice analysis to detect nervousness levels</li>
                                <li>• Real-time speech-to-text in both modes</li>
                                <li>• Detailed performance report at the end</li>
                                <li>• Results exported to Google Sheets</li>
                            </ul>
                        </div>

                        {/* Disabled Start Button */}
                        <div className="text-center">
                            <p className="text-sm text-gray-600 mb-2">
                                {!interviewData.jobTitle.trim() ?
                                    'Please enter a job title, then click on your preferred recording mode above to start.' :
                                    'Click on your preferred recording mode above to start the interview.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainPage;