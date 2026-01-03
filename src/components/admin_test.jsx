import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TestPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const routeTestCode = location.state?.testCode;
  const storedTestCode =
    typeof window !== "undefined"
      ? localStorage.getItem("adminCurrentTestCode")
      : "";
  const testCode = routeTestCode || storedTestCode || "";

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);

  // If no testCode, go back to admin; otherwise remember it
  useEffect(() => {
    if (!testCode) {
      navigate("/admin");
    } else {
      localStorage.setItem("adminCurrentTestCode", testCode);
    }
  }, [testCode, navigate]);

  const updateQuestion = () => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      question: currentQuestion,
      options,
    };
    setQuestions(updatedQuestions);
  };

  const handleAddOrNextQuestion = () => {
    if (currentQuestionIndex === questions.length) {
      // Add new question
      setQuestions([
        ...questions,
        { question: currentQuestion, options: [...options] },
      ]);
    } else {
      // Update existing question
      const updatedQuestions = [...questions];
      updatedQuestions[currentQuestionIndex] = {
        question: currentQuestion,
        options: [...options],
      };
      setQuestions(updatedQuestions);
    }

    setCurrentQuestion("");
    setOptions(["", "", "", ""]);
    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const previousQuestion = questions[currentQuestionIndex - 1];
      setCurrentQuestion(previousQuestion?.question || "");
      setOptions(previousQuestion?.options || ["", "", "", ""]);
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleQuestionClick = (index) => {
    // index may be equal to questions.length when clicking the "next/new" button
    const selectedQuestion = questions[index];
    setCurrentQuestion(selectedQuestion?.question || "");
    setOptions(selectedQuestion?.options || ["", "", "", ""]);
    setCurrentQuestionIndex(index);
  };

  const handleSubmit = async () => {
    const updatedQuestions = [...questions];
    // Ensure the current question is included in the payload
    updatedQuestions[currentQuestionIndex] = {
      question: currentQuestion,
      options,
    };

    const questionData = {
      testCode: testCode,
      timer: 30*60, // seconds; consistent with your original code
      questions: updatedQuestions,
    };

    try {
      const response = await fetch("http://127.0.0.1:5000/create-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(questionData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Submitted Questions: ", result);
        alert("Test Submitted Successfully!");
        navigate("/dashboard", {
          state: { testCode: questionData.testCode },
        });
      } else {
        throw new Error("Failed to submit questions");
      }
    } catch (error) {
      console.error("Error:", error);
      alert(
        "There was an error submitting the questions. Please try again."
      );
    }
  };

  const handleRemoveQuestion = (index) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);

    if (updatedQuestions.length === 0) {
      // No questions left
      setCurrentQuestion("");
      setOptions(["", "", "", ""]);
      setCurrentQuestionIndex(0);
      return;
    }

    // Adjust current index if needed
    let newIndex = currentQuestionIndex;
    if (currentQuestionIndex >= updatedQuestions.length) {
      newIndex = updatedQuestions.length - 1;
    }

    setCurrentQuestionIndex(newIndex);
    const newCurrent = updatedQuestions[newIndex];
    setCurrentQuestion(newCurrent?.question || "");
    setOptions(newCurrent?.options || ["", "", "", ""]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-50 p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2 font-Orbitron">
        Create Test
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Configure questions for test code{" "}
        <span className="font-semibold">{testCode}</span>.
      </p>

      <div className="w-full max-w-6xl mb-4 flex flex-col md:flex-row gap-4">
        {/* Static test info card */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 w-full md:w-1/3">
          <h2 className="text-lg font-semibold mb-2 font-Orbitron">
            Test Details
          </h2>
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-semibold">Code:</span> {testCode}
          </p>
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-semibold">Questions:</span>{" "}
            {questions.length || 0}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Questions and options you define here will be stored in the backend
            database and used for the proctored exam session.
          </p>
        </div>

        {/* Optional static help card */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 w-full md:w-2/3">
          <h2 className="text-lg font-semibold mb-2 font-Orbitron">
            How to Use
          </h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Use the left panel to navigate between questions.</li>
            <li>Each question has four options by default.</li>
            <li>You can add a new question or edit existing ones.</li>
            <li>
              Click &quot;Submit Test&quot; only when you&apos;ve finished
              defining all questions.
            </li>
          </ul>
        </div>
      </div>

      {/* Main container with flex row layout */}
      <div className="flex w-full max-w-6xl">
        {/* Question navigation panel */}
        <div className="w-[55%] bg-white p-4 m-4 rounded-md shadow-md">
          <h2 className="text-xl font-semibold mb-2 font-Orbitron">
            Navigate Questions
          </h2>
          <div className="flex flex-wrap gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                className={`px-5 py-3 border rounded ${
                  index === currentQuestionIndex
                    ? "bg-blue-500 text-white"
                    : "bg-gray-300"
                }`}
                onClick={() => handleQuestionClick(index)}
              >
                {index + 1}
              </button>
            ))}
            {/* Button representing the next (new) question slot */}
            <button
              className={`px-5 py-3 border rounded ${
                currentQuestionIndex === questions.length
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300"
              }`}
              onClick={() => handleQuestionClick(questions.length)}
            >
              {questions.length + 1}
            </button>
          </div>
        </div>

        {/* Question editor panel */}
        <div className="w-3/4 ml-4 bg-white p-4 rounded shadow-md">
          <h2 className="text-xl font-semibold mb-2 font-Orbitron">
            Question {currentQuestionIndex + 1} :
          </h2>
          <input
            type="text"
            value={currentQuestion}
            onChange={(e) => setCurrentQuestion(e.target.value)}
            placeholder="Enter your question"
            className="w-full mb-4 p-2 border rounded text-lex"
          />
          <div>
            <h1 className="text-xl font-semibold mb-2 font-Orbitron">
              Options :
            </h1>
          </div>
          {options.map((option, index) => (
            <input
              key={index}
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="w-full mb-2 p-2 border rounded text-lex"
            />
          ))}

          <div className="flex justify-between mt-4">
            <button
              onClick={handlePrevQuestion}
              className={`p-2 bg-gray-300 rounded font-Orbitron ${
                currentQuestionIndex === 0
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </button>
            <div className="flex items-center">
              {questions.length > 0 && (
                <button
                  onClick={() => handleRemoveQuestion(currentQuestionIndex)}
                  className="bg-red-500 text-white p-2 rounded mr-2 font-Orbitron"
                >
                  Remove Question
                </button>
              )}
              <button
                onClick={handleAddOrNextQuestion}
                className="bg-blue-500 text-white p-2 rounded mr-2 font-Orbitron"
              >
                {currentQuestionIndex === questions.length
                  ? "Add Question"
                  : "Next"}
              </button>
              {questions.length > 0 && (
                <button
                  onClick={handleSubmit}
                  className="bg-green-500 text-white p-2 rounded font-Orbitron"
                >
                  Submit Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPage;