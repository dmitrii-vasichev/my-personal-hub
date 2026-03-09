from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ResumeGenerateRequest(BaseModel):
    application_id: int


class AtsAuditResult(BaseModel):
    score: int
    matched_keywords: list[str] = []
    missing_keywords: list[str] = []
    formatting_issues: list[str] = []
    suggestions: list[str] = []


class GapAnalysisResult(BaseModel):
    matching_skills: list[str] = []
    missing_skills: list[str] = []
    strengths: list[str] = []
    recommendations: list[str] = []


class ResumeResponse(BaseModel):
    id: int
    application_id: int
    version: int
    resume_json: dict
    pdf_url: Optional[str]
    ats_score: Optional[int]
    ats_audit_result: Optional[dict]
    gap_analysis: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class CoverLetterGenerateRequest(BaseModel):
    application_id: int


class CoverLetterResponse(BaseModel):
    id: int
    application_id: int
    version: int
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
