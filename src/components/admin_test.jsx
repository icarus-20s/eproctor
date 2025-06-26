import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TestPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const testCode = location.state?.testCode;

  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);

  const updateQuestion = () => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      question: currentQuestion,
      options,
    };
    setQuestions(updatedQuestions);
  };

  const handleAddOrNextQuestion = () => {
    updateQuestion();

    if (currentQuestionIndex === questions.length) {
      setQuestions([...questions, { question: currentQuestion, options }]);
    }

    setCurrentQuestion('');
    setOptions(['', '', '', '']);
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const previousQuestion = questions[currentQuestionIndex - 1];
      setCurrentQuestion(previousQuestion?.question || '');
      setOptions(previousQuestion?.options || ['', '', '', '']);
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleQuestionClick = (index) => {
    const selectedQuestion = questions[index];
    setCurrentQuestion(selectedQuestion?.question || '');
    setOptions(selectedQuestion?.options || ['', '', '', '']);
    setCurrentQuestionIndex(index);
  };


  const handleSubmit = async () => {
    updateQuestion();  // Ensure the current question is updated in the array
    console.log(updateQuestion)
    if (currentQuestionIndex === questions.length) {
      setQuestions([...questions, { question: currentQuestion, options }]);
    }
    const questionData = {
        testCode: testCode,  // Replace with your actual test code logic
        timer: 60,  // Replace with your actual timer value or state
        questions: questions  // Array of questions you've collected
    };

    try {
        // Make the POST request to your Flask backend
        const response = await fetch('http://127.0.0.1:5000/create-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',  // Specify content type as JSON
            },
            body: JSON.stringify(questionData)  // Convert the questionData object to JSON
        });

        // Check if the request was successful
        if (response.ok) {
            const result = await response.json();  // Get the result from the backend
            console.log("Submitted Questions: ", result);
            alert("Test Submitted Successfully!");

            // Redirect to the Dashboard component
            navigate('/dashboard', { state: { testCode: questionData.testCode } });
        } else {
            throw new Error('Failed to submit questions');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('There was an error submitting the questions. Please try again.');
    }
  };

  const handleRemoveQuestion = (index) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
    // Adjust the current question index if needed
    if (currentQuestionIndex >= updatedQuestions.length) {
      setCurrentQuestionIndex(updatedQuestions.length - 1);
    }
    // If the removed question was the current one, reset the inputs
    if (currentQuestionIndex === index) {
      const newCurrent = updatedQuestions[currentQuestionIndex - 1];
      setCurrentQuestion(newCurrent?.question || '');
      setOptions(newCurrent?.options || ['', '', '', '']);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 font-Orbitron">
        Test Code: {testCode}
      </h1>

      {/* Main container with flex row layout */}
      <div className="flex w-full max-w-6xl">
        {/* Buttons to navigate between questions */}
        <div className="w-[55%] bg-white p-4 m-4 rounded-md shadow-md">
          <h2 className="text-xl font-semibold mb-2 font-Orbitron">Navigate Questions</h2>
          <div className="flex flex-wrap gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                className={`px-5 py-3 border rounded ${
                  index === currentQuestionIndex ? 'bg-blue-500 text-white' : 'bg-gray-300'
                }`}
                onClick={() => handleQuestionClick(index)}
              >
                {index + 1}
              </button>
            ))}
            {/* Add button for current question */}
            <button
              className={`px-5 py-3 border rounded  ${
                currentQuestionIndex === questions.length ? 'bg-blue-500 text-white' : 'bg-gray-300'
              }`}
              onClick={() => handleQuestionClick(questions.length)}
            >
              {questions.length + 1}
            </button>
          </div>
        </div>

        {/* Question form section on the right */}
        <div className="w-3/4 ml-4 bg-white p-4 rounded shadow-md">
          <h2 className="text-xl font-semibold mb-2 font-Orbitron">Question {currentQuestionIndex + 1} :</h2>
          <input
            type="text"
            value={currentQuestion}
            onChange={(e) => setCurrentQuestion(e.target.value)}
            placeholder="Enter your question"
            className="w-full mb-4 p-2 border rounded text-lex"
          />
          <div>
            <h1 className='text-xl font-semibold mb-2 font-Orbitron'>Options :</h1>
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
                currentQuestionIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
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
                {currentQuestionIndex === questions.length ? 'Add Question' : 'Next'}
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