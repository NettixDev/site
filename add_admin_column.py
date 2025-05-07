#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from app import app, db

with app.app_context():
    db.engine.execute('ALTER TABLE user ADD COLUMN is_admin BOOLEAN DEFAULT 0')
    print(" олонка is_admin успешно добавлена в таблицу user")
