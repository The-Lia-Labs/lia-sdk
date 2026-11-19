package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	lia "github.com/The-Lia-Labs/lia-server-go"
	_ "github.com/mattn/go-sqlite3"
	"os"
	"path/filepath"
)

var products = map[string]int64{"coins-100": 100}

type store struct {
	db     *sql.DB
	client *lia.Client
}
type charge struct {
	ID        string `json:"id"`
	PlayerID  string `json:"playerId"`
	ProductID string `json:"productId"`
	Status    string `json:"status"`
	Mode      string `json:"mode"`
}

func newStore(client *lia.Client) (*store, error) {
	file := os.Getenv("LIA_INVENTORY_DB")
	if file == "" {
		file = "data/inventory.sqlite"
	}
	if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite3", file+"?_busy_timeout=5000&_txlock=immediate")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS inventory(mode TEXT,player TEXT,coins INTEGER,PRIMARY KEY(mode,player));CREATE TABLE IF NOT EXISTS receipt(mode TEXT,id TEXT,player TEXT,coins INTEGER,PRIMARY KEY(mode,id));`)
	if err != nil {
		db.Close()
		return nil, err
	}
	return &store{db: db, client: client}, nil
}
func (s *store) inventory(ctx context.Context, player string) (map[string]int64, error) {
	var coins int64
	err := s.db.QueryRowContext(ctx, "SELECT coins FROM inventory WHERE mode=? AND player=?", s.client.Mode(), player).Scan(&coins)
	if errors.Is(err, sql.ErrNoRows) {
		err = nil
	}
	return map[string]int64{"coins": coins}, err
}
func (s *store) charge(ctx context.Context, id string) (*charge, error) {
	result, err := s.client.GetCharge(ctx, lia.Params{"id": id}, lia.RequestOptions{})
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	var response struct {
		Charge charge `json:"charge"`
	}
	if err = json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	if response.Charge.ID == "" {
		return nil, &lia.Error{Code: "invalid_charge", Status: 409}
	}
	return &response.Charge, nil
}
func (s *store) settle(ctx context.Context, id, player string) (map[string]int64, error) {
	c, err := s.charge(ctx, id)
	if err != nil {
		return nil, err
	}
	coins := products[c.ProductID]
	if c.Mode != s.client.Mode() || player != "" && c.PlayerID != player || (c.Status != "paid" && c.Status != "delivered") || coins <= 0 {
		return nil, &lia.Error{Code: "charge_not_deliverable", Status: 409}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var previousPlayer string
	var previousCoins int64
	err = tx.QueryRowContext(ctx, "SELECT player,coins FROM receipt WHERE mode=? AND id=?", c.Mode, "charge:"+c.ID).Scan(&previousPlayer, &previousCoins)
	if err == nil && (previousPlayer != c.PlayerID || previousCoins != coins) {
		return nil, &lia.Error{Code: "receipt_conflict", Status: 409}
	}
	if errors.Is(err, sql.ErrNoRows) {
		if _, err = tx.ExecContext(ctx, "INSERT INTO receipt VALUES(?,?,?,?)", c.Mode, "charge:"+c.ID, c.PlayerID, coins); err != nil {
			return nil, err
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO inventory VALUES(?,?,?) ON CONFLICT(mode,player) DO UPDATE SET coins=coins+excluded.coins", c.Mode, c.PlayerID, coins); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	if _, err = s.client.DeliverCharge(ctx, lia.Params{"id": c.ID}, lia.RequestOptions{IdempotencyKey: "deliver:" + c.ID}); err != nil {
		return nil, err
	}
	return s.inventory(ctx, c.PlayerID)
}
func (s *store) refund(ctx context.Context, id string) error {
	c, err := s.charge(ctx, id)
	if err != nil {
		return err
	}
	if c.Mode != s.client.Mode() || c.Status != "refunded" {
		return &lia.Error{Code: "invalid_refund", Status: 409}
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var player string
	var coins int64
	err = tx.QueryRowContext(ctx, "SELECT player,coins FROM receipt WHERE mode=? AND id=?", c.Mode, "charge:"+c.ID).Scan(&player, &coins)
	if errors.Is(err, sql.ErrNoRows) {
		return tx.Commit()
	}
	if err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, "INSERT OR IGNORE INTO receipt VALUES(?,?,?,?)", c.Mode, "refund:"+c.ID, player, -coins)
	if err != nil {
		return err
	}
	added, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if added > 0 {
		if _, err = tx.ExecContext(ctx, "UPDATE inventory SET coins=coins-? WHERE mode=? AND player=?", coins, c.Mode, player); err != nil {
			return err
		}
	}
	return tx.Commit()
}
