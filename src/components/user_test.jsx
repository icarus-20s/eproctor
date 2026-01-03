import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import FaceOrientationChecker from "./video";

const McqTest = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialUsername =
    location.state?.username || localStorage.getItem("username") || "";

  const [username] = useState(initialUsername);
  const [testCode, setTestCode] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [stopMonitoring, setStopMonitoring] = useState(false);
  const [remainingWarnings, setRemainingWarnings] = useState(4);
  const countdownIntervalRef = useRef(null);
  const isCountdownActiveRef = useRef(false);
  const [timer, setTimer] = useState(90 * 60); // fallback default (seconds)
  const timerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionLogin, setSessionLogin] = useState("");
  const [message, setMessage] = useState("");
  const [ip, setIp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for autosave
  const answersRef = useRef(answers);
  const remainingTimeRef = useRef(timer);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    remainingTimeRef.current = timer;
  }, [timer]);

  // Initialize session login time
  useEffect(() => {
    setSessionLogin(new Date().toISOString());
  }, []);

  // Store username in localStorage for video component / backend
  useEffect(() => {
    if (username) {
      localStorage.setItem("username", username);
    }
  }, [username]);

  // Fetch IP address and request camera permission once
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        console.log("Camera permission granted");
      })
      .catch((err) => {
        console.error("Camera permission denied:", err);
      });

    const fetchIp = async () => {
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        setIp(data.ip);
      } catch (error) {
        console.error("Error fetching IP address:", error);
      }
    };
    fetchIp();
  }, []);

  // Check for authentication token and username
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!username && !token) {
      navigate("/login_user");
    }
  }, [username, navigate]);

  // Timer effect
  useEffect(() => {
    if (isTestStarted && timer > 0 && !isSubmitting) {
      timerRef.current = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            handleSubmitTest();
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTestStarted, timer, isSubmitting]);

  // Periodic autosave to backend
  useEffect(() => {
    if (!isTestStarted || !username || !testCode) return;

    const intervalId = setInterval(() => {
      axios
        .post("http://localhost:5000/autosave-test", {
          username,
          test_code: testCode,
          answers: answersRef.current,
          remaining_time: remainingTimeRef.current,
        })
        .catch((err) => {
          console.error("Autosave failed:", err?.response?.data || err.message);
        });
    }, 30000); // every 30s

    return () => clearInterval(intervalId);
  }, [isTestStarted, username, testCode]);

  // Convert seconds to mm:ss
  const formatTime = () => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTestStarted && !isSubmitting && isFullscreen) {
        showWarning();
        console.log("Tab switched - showing warning");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isTestStarted, isSubmitting, isFullscreen]);

  // Keyboard and right-click restrictions
  useEffect(() => {
    const handleRightClick = (event) => {
      if (isTestStarted) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event) => {
      if (isFullscreen && isTestStarted) {
        const charCode = event.charCode || event.keyCode || event.which;

        if (charCode === 27) {
          alert("Escape key is not allowed");
          event.preventDefault();
        }

        if (event.ctrlKey && event.altKey) {
          if (event.key === "Delete") {
            handleSubmitTest();
            event.preventDefault();
          } else {
            showWarning();
            event.preventDefault();
          }
        }

        if (event.metaKey) {
          showWarning();
          event.preventDefault();
        }

        if (
          (event.ctrlKey || event.metaKey) &&
          ["a", "i", "c", "u", "t", "alt"].includes(
            event.key.toLowerCase()
          )
        ) {
          event.preventDefault();
        }

        if (event.altKey && event.key === "Tab") {
          alert("Switching to another application is not allowed!");
          event.preventDefault();
        }

        if (event.ctrlKey && event.key === "Tab") {
          event.preventDefault();
        }

        if (event.ctrlKey || event.altKey) {
          event.preventDefault();
        }
      }
    };

    document.addEventListener("contextmenu", handleRightClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleRightClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, isTestStarted]);

  const fetchTest = async () => {
    if (!testCode.trim()) return;

    try {
      const response = await axios.get(
        `http://localhost:5000/get-test-data/${testCode}`
      );
      const data = response.data;

      if (data && data.questions && data.questions.length > 0) {
        const backendTimer = Number(data.timer) || 0;
        let initialTimer = backendTimer > 0 ? backendTimer : 90 * 60;
        let initialAnswers = {};

        // Attempt to resume existing session
        if (username) {
          try {
            const resumeRes = await fetch(
              "http://localhost:5000/resume-test",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  username,
                  test_code: testCode,
                }),
              }
            );

            const resumeData = await resumeRes.json().catch(() => ({}));

            if (resumeRes.ok && resumeData.allowed) {
              // Successful resume: use remaining_time and last_answers
              console.log("Resuming previous session:", resumeData);
              initialTimer =
                typeof resumeData.remaining_time === "number" &&
                resumeData.remaining_time > 0
                  ? resumeData.remaining_time
                  : initialTimer;
              initialAnswers = resumeData.last_answers || {};
            } else if (resumeRes.status === 403 && resumeData.reason) {
              // Session exists but cannot be resumed (submitted/terminated)
              alert(resumeData.reason);
              return; // do not start a new exam
            } else {
              // 404 (no session) or other non-fatal cases: start fresh
              console.log(
                "No resumable session or resume denied, starting new exam:",
                resumeData
              );
            }
          } catch (err) {
            console.error("Resume request failed, starting new exam:", err);
          }
        }

        setQuestions(data.questions);
        setAnswers(initialAnswers);
        setTimer(initialTimer);

        // Persist for proctoring component
        localStorage.setItem("testCode", testCode);
        if (username) {
          localStorage.setItem("username", username);
        }

        setIsTestStarted(true);
        setTimeout(() => {
          enterFullscreen();
        }, 100);
      } else {
        alert(
          "The test code you entered is invalid or no questions found. Please try again."
        );
        setQuestions([]);
      }
    } catch (error) {
      console.error("Error fetching test data:", error);
      alert(
        "Error fetching test data. Please check your connection and try again."
      );
    }
  };

  const enterFullscreen = async () => {
    try {
      const elem = document.documentElement;

      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (error) {
      console.error("Error entering fullscreen:", error);
      alert(
        "Unable to enter fullscreen mode. Please manually press F11 or use your browser's fullscreen."
      );
    }
  };

  const handleFullscreenChange = () => {
    const fullscreenEl =
      document.fullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement;

    if (fullscreenEl) {
      setIsFullscreen(true);
      resetCountdown();
    } else {
      setIsFullscreen(false);
      if (isTestStarted && !isSubmitting) {
        showWarning();
      }
    }
  };

  // Set up fullscreen event listeners
  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange
    );
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, [isTestStarted, isSubmitting]);

  const showWarning = () => {
    if (remainingWarnings > 0 && !isSubmitting) {
      setWarningVisible(true);
      setModalVisible(true);
      setRemainingWarnings((prev) => {
        const newRemaining = prev - 1;
        if (newRemaining <= 0) {
          setTimeout(() => handleSubmitTest(), 100);
        }
        return newRemaining;
      });

      if (!isCountdownActiveRef.current) {
        startCountdown();
      }
    } else {
      handleSubmitTest();
    }
  };

  const startCountdown = () => {
    setCountdown(6);
    isCountdownActiveRef.current = true;
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          isCountdownActiveRef.current = false;
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setCountdown(6);
    setWarningVisible(false);
    setModalVisible(false);
    isCountdownActiveRef.current = false;
  };

  const handleOptionChange = (index) => {
    setSelectedOption(index);
  };

  const handleNextQuestion = () => {
    if (selectedOption !== null) {
      const currentQuestion = questions[currentQuestionIndex]?.question;
      setAnswers((prevAnswers) => ({
        ...prevAnswers,
        [currentQuestion]:
          questions[currentQuestionIndex]?.options[selectedOption],
      }));
    }

    setSelectedOption(null);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      if (selectedOption !== null) {
        const currentQuestion = questions[currentQuestionIndex]?.question;
        setAnswers((prevAnswers) => ({
          ...prevAnswers,
          [currentQuestion]:
            questions[currentQuestionIndex]?.options[selectedOption],
        }));
      }

      const newIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(newIndex);

      const previousQuestion = questions[newIndex]?.question;
      const previousAnswer = answers[previousQuestion];
      setSelectedOption(
        previousAnswer
          ? questions[newIndex]?.options.indexOf(previousAnswer)
          : null
      );
    }
  };

  const handleQuestionNavigation = (index) => {
    if (selectedOption !== null) {
      const currentQuestion = questions[currentQuestionIndex]?.question;
      setAnswers((prevAnswers) => ({
        ...prevAnswers,
        [currentQuestion]:
          questions[currentQuestionIndex]?.options[selectedOption],
      }));
    }

    setCurrentQuestionIndex(index);

    const targetQuestion = questions[index]?.question;
    const targetAnswer = answers[targetQuestion];
    setSelectedOption(
      targetAnswer ? questions[index]?.options.indexOf(targetAnswer) : null
    );
  };

  const handleSubmitTest = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      setStopMonitoring(true);

      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      const updatedAnswers = { ...answers };

      if (selectedOption !== null && questions[currentQuestionIndex]) {
        const currentQuestion = questions[currentQuestionIndex].question;
        updatedAnswers[currentQuestion] =
          questions[currentQuestionIndex].options[selectedOption];
      }

      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5000/submit-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          username,
          test_id: testCode,
          answers: updatedAnswers,
          session_login: sessionLogin,
          ip_address: ip,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit the test.");
      }

      setMessage("Test submitted successfully.");
      console.log("Submitted Answers:", updatedAnswers);

      await exitFullscreen();

      setTimeout(() => {
        navigate("/user", {
          state: {
            username,
            message: "Test submitted successfully!",
          },
        });
      }, 1500);
    } catch (error) {
      setMessage(`Error submitting test: ${error.message}`);
      console.error("Error submitting test:", error);
      setIsSubmitting(false);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
    } catch (error) {
      console.error("Error exiting fullscreen:", error);
    }
    setIsFullscreen(false);
  };

  const handleTestCodeChange = (e) => {
    setTestCode(e.target.value);
  };

  const handleModalClose = () => {
    if (remainingWarnings === 0) {
      handleSubmitTest();
    } else {
      resetCountdown();
      enterFullscreen();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      exitFullscreen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex user-select-none flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {!isTestStarted ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-4 ml-40 mt-24 font-Orbitron">
              Enter Test Code:
            </h1>
            <input
              type="text"
              placeholder="Enter Test Code"
              value={testCode}
              onChange={handleTestCodeChange}
              className="w-full max-w-xs p-2 border rounded mb-4 ml-40 font-Lex"
            />
            <button
              onClick={fetchTest}
              className="bg-blue-500 text-white px-4 py-2 rounded ml-4 font-Orbitron"
              disabled={!testCode.trim()}
            >
              Submit Code
            </button>

            <div className="font-Cabin bg-slate-200 hover:shadow-xl m-8 p-4 rounded-lg text-xl">
              <h1 className="text-3xl mb-4 font-Orbitron">Rules:</h1>
              <ul className="list-disc list-inside space-y-2 font-Lex">
                <li>Upon the end of time, the exam will be automatically submitted.</li>
                <li>Students should not switch tabs during examinations.</li>
                <li>Students should not exit fullscreen mode during examination.</li>
                <li>Students must make sure that they are facing the camera.</li>
                <li>Repeated offenses will lead to exam termination.</li>
              </ul>
            </div>
          </>
        ) : (
          <div>
            {message && (
              <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-md shadow-lg z-50">
                {message}
              </div>
            )}

            <div className="flex w-full mt-4 space-x-4">
              <div className="flex-grow absolute left-0 w-[70%] m-8 h-[70%] bg-gray-100 rounded-sm p-4 shadow-xl">
                <div className="flex justify-between items-center mx-24 mt-4">
                  <h2 className="text-5xl font-semibold mb-9 font-Orbitron">
                    Question {currentQuestionIndex + 1} of {questions.length}:
                  </h2>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4 text-right font-Orbitron">
                    Test Code: {testCode}
                  </h1>
                </div>

                {questions[currentQuestionIndex] && (
                  <>
                    <p className="mb-9 text-3xl font-lex ml-24">
                      {questions[currentQuestionIndex].question}
                    </p>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4 text-left ml-24 font-Orbitron">
                      Options:
                    </h1>
                    {questions[currentQuestionIndex].options.map(
                      (option, index) => (
                        <div key={index} className="mb-2 text-2xl ml-24">
                          <label className="flex items-center font-lex cursor-pointer">
                            <input
                              type="radio"
                              name={`question-${currentQuestionIndex}`}
                              checked={selectedOption === index}
                              onChange={() => handleOptionChange(index)}
                              className="hidden peer"
                            />
                            <span className="w-4 h-4 rounded-full border border-gray-400 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all"></span>
                            <span className="ml-3 text-gray-800 font-lex">
                              {option}
                            </span>
                          </label>
                        </div>
                      )
                    )}
                  </>
                )}

                <div className="flex start mx-2 mt-20 font-Orbitron">
                  <button
                    onClick={handlePrevQuestion}
                    className="bg-gray-300 text-gray-800 px-4 py-2 mx-4 ml-24 rounded"
                    disabled={currentQuestionIndex === 0 || isSubmitting}
                  >
                    Previous
                  </button>
                  <button
                    onClick={
                      currentQuestionIndex === questions.length - 1
                        ? handleSubmitTest
                        : handleNextQuestion
                    }
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : currentQuestionIndex === questions.length - 1
                      ? "Submit Test"
                      : "Next"}
                  </button>
                </div>
              </div>

              <div className="absolute bottom-0 right-3 w-[25%] h-[40%] bg-gray-100 p-4 m-4 rounded-md shadow-md">
                <h2 className="text-xl font-semibold mb-4 font-Orbitron">
                  Navigate Questions
                </h2>
                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                  {questions.map((_, index) => (
                    <button
                      key={index}
                      className={`px-3 py-2 border rounded text-sm ${
                        index === currentQuestionIndex
                          ? "bg-blue-500 text-white"
                          : answers[questions[index]?.question]
                          ? "bg-green-300 text-black"
                          : "bg-gray-300"
                      }`}
                      onClick={() => handleQuestionNavigation(index)}
                      disabled={isSubmitting}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black absolute top-0 right-7 mt-16 w-[25%] h-[45%] rounded-md shadow-md">
                <FaceOrientationChecker stopSignal={stopMonitoring} />
              </div>

              <div className="absolute flex flex-row justify-start items-center bottom-8 py-10 px-24 bg-gray-100 shadow-xl rounded-md ml-4 left-3 w-[70%] m-2">
                <p className="text-5xl font-medium">Timer:</p>
                <h1
                  className={`text-8xl mx-4 ${
                    timer < 300 ? "text-red-500" : ""
                  }`}
                >
                  {formatTime()}
                </h1>
                <div className="text-3xl">Minutes</div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        {modalVisible && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded shadow-lg w-1/2">
              <h2 className="text-2xl font-bold mb-4 font-Lex text-red-700">
                Warning!!!
              </h2>
              <p>
                You've exited fullscreen mode. Please return to fullscreen to
                continue the test. You have {remainingWarnings} warnings left.
                The test will be submitted in {countdown} seconds if you don't
                return to fullscreen.
              </p>
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleModalClose}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  disabled={isSubmitting}
                >
                  Return to Fullscreen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default McqTest;