from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SkillEntry(BaseModel):
    name: str
    level: Optional[str] = None
    years: Optional[float] = None


class ExperienceEntry(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None


class EducationEntry(BaseModel):
    degree: str
    institution: str
    year: Optional[int] = None


class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None


class ProfileUpdate(BaseModel):
    summary: Optional[str] = None
    skills: Optional[list[SkillEntry]] = None
    experience: Optional[list[ExperienceEntry]] = None
    education: Optional[list[EducationEntry]] = None
    contacts: Optional[ContactInfo] = None


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    summary: Optional[str]
    skills: list[SkillEntry]
    experience: list[ExperienceEntry]
    education: list[EducationEntry]
    contacts: ContactInfo
    raw_import: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileImportRequest(BaseModel):
    text: str
