import pytest
from unittest.mock import patch, MagicMock
from gemini_model_resolver import generate_with_fallback, get_dynamic_cascade, _score_model

def test_score_model():
    # Test scoring logic
    assert _score_model("models/gemini-3.1-pro-preview") > _score_model("models/gemini-2.5-pro")
    assert _score_model("gemini-3.1-flash-lite-preview") < _score_model("gemini-3.1-pro")

@patch('gemini_model_resolver.genai.GenerativeModel')
@patch('gemini_model_resolver.get_dynamic_cascade')
def test_generate_with_fallback_success_first_try(mock_cascade, MockGenerativeModel):
    mock_cascade.return_value = ["model1", "model2"]
    
    mock_instance = MagicMock()
    mock_instance.generate_content.return_value = "Success Response"
    MockGenerativeModel.return_value = mock_instance
    
    response, used_model = generate_with_fallback("fake_key", "model1", "test context")
    
    assert used_model == "model1"
    assert response == "Success Response"
    mock_instance.generate_content.assert_called_once()

@patch('gemini_model_resolver.genai.GenerativeModel')
@patch('gemini_model_resolver.get_dynamic_cascade')
def test_generate_with_fallback_triggers_fallback_on_429(mock_cascade, MockGenerativeModel):
    mock_cascade.return_value = ["model_primary", "model_fallback"]
    
    # First model raises 429, second succeeds
    mock_instance_primary = MagicMock()
    mock_instance_primary.generate_content.side_effect = Exception("HTTP 429 Too Many Requests: Quota Exhausted")
    
    mock_instance_fallback = MagicMock()
    mock_instance_fallback.generate_content.return_value = "Fallback Response"
    
    # Return different mocks sequentially
    MockGenerativeModel.side_effect = [mock_instance_primary, mock_instance_fallback]
    
    response, used_model = generate_with_fallback("fake_key", "model_primary", "test context")
    
    assert used_model == "model_fallback"
    assert response == "Fallback Response"
    assert MockGenerativeModel.call_count == 2
